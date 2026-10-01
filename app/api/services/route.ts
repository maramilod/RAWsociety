import { NextResponse } from "next/server";
import { query, queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { currentPlanCode } from "@/lib/subscriptions";
import { serviceLoad } from "@/lib/service-limits";
import { creatorRules } from "@/lib/plan-rules";
import {
  CURRENCY,
  LINK_KINDS,
  MAX_DELIVERABLES,
  MAX_IMAGES,
  MAX_LINKS,
  MAX_SERVICES_PER_CREATOR,
  MAX_TAGS,
  SERVICE_COLUMNS,
  hydrateServices,
  parseServiceInput,
  type ServiceRow,
} from "@/lib/services";
import { createService } from "@/lib/service-store";
import { readServiceRequest } from "@/lib/service-request";
import { UploadError } from "@/lib/uploads";

interface CategoryRow extends RowDataPacket {
  id: number;
  name: string;
}

async function requireCreator() {
  const me = await getSessionUser();
  if (!me) return { error: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  if (me.role !== "creator") {
    return { error: NextResponse.json({ error: "Only creator accounts can offer services." }, { status: 403 }) };
  }
  return { me };
}

// The creator's own services (including paused ones) plus what the form needs
export async function GET() {
  const auth = await requireCreator();
  if (auth.error) return auth.error;

  try {
    const [rows, categories, profile] = await Promise.all([
      query<ServiceRow>(
        `SELECT ${SERVICE_COLUMNS}
           FROM services s JOIN categories c ON c.id = s.category_id
          WHERE s.creator_id = ?
          ORDER BY s.created_at DESC`,
        [auth.me.id]
      ),
      query<CategoryRow>("SELECT id, name FROM categories WHERE is_active = 1 ORDER BY sort_order, name"),
      queryOne<RowDataPacket & { category_id: number }>(
        "SELECT category_id FROM creator_profiles WHERE user_id = ?",
        [auth.me.id]
      ),
    ]);

    return NextResponse.json({
      services: await hydrateServices(rows).then(async (list) => {
        const loads = await serviceLoad(list.map((s) => s.id));
        return list.map((s) => ({ ...s, monthly: loads.get(s.id) ?? null }));
      }),
      liveLimit: creatorRules(await currentPlanCode(auth.me.id, "creator")).liveServices,
      categories,
      defaultCategoryId: profile?.category_id ?? null,
      hasProfile: !!profile,
      currency: CURRENCY,
      limits: {
        images: MAX_IMAGES,
        links: MAX_LINKS,
        tags: MAX_TAGS,
        deliverables: MAX_DELIVERABLES,
      },
      linkKinds: LINK_KINDS,
    });
  } catch (err) {
    console.error("list services failed:", err);
    return NextResponse.json({ error: "Could not load your services." }, { status: 500 });
  }
}

// Create a service (multipart form: fields + images)
export async function POST(request: Request) {
  const auth = await requireCreator();
  if (auth.error) return auth.error;

  const req = await readServiceRequest(request);
  if (!req) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const parsed = await parseServiceInput(req.fields);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    // A service belongs to a creator profile (specialty, bio, ...), so that must exist first
    const profile = await queryOne<RowDataPacket>(
      "SELECT user_id FROM creator_profiles WHERE user_id = ?",
      [auth.me.id]
    );
    if (!profile) {
      return NextResponse.json(
        { error: "Please complete your creator profile before adding a service." },
        { status: 409 }
      );
    }

    const count = await queryOne<RowDataPacket & { n: number }>(
      "SELECT COUNT(*) AS n FROM services WHERE creator_id = ?",
      [auth.me.id]
    );
    if ((count?.n ?? 0) >= MAX_SERVICES_PER_CREATOR) {
      return NextResponse.json(
        { error: `You can have up to ${MAX_SERVICES_PER_CREATOR} services.` },
        { status: 400 }
      );
    }

    // how many services can be live at once depends on the plan
    const limit = creatorRules(await currentPlanCode(auth.me.id, "creator")).liveServices;
    const live = await queryOne<RowDataPacket & { n: number }>("SELECT COUNT(*) AS n FROM services WHERE creator_id = ? AND is_active = 1", [auth.me.id]);
    if (limit !== null && Number(live?.n ?? 0) >= limit) {
      return NextResponse.json(
        { error: `Your plan lets you offer ${limit} services at a time. Pause one of yours or upgrade your plan to add more.`, upgrade: true },
        { status: 403 }
      );
    }

    const id = await createService(auth.me.id, parsed.data, req.images);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("create service failed:", err);
    return NextResponse.json({ error: "Could not save the service." }, { status: 500 });
  }
}
