import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { parseDeliveryLinks } from "@/lib/deliveries";
import { UploadError } from "@/lib/uploads";
import { isUuid, money, obj, text } from "@/lib/custom-requests";
import { RequestError, sweepJobs } from "@/lib/jobs";
import { creatorJobAccess } from "@/lib/subscriptions";
import { MAX_APPLICATION_LINKS } from "@/lib/plan-rules";

// A creator applies to a job with an offer: price, days, a message and optionally links to earlier work.
// The plan decides whether they can and how many times a month.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "creator") return NextResponse.json({ error: "Only creator accounts can apply to jobs." }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  let price: number;
  let days: number;
  let message: string;
  let links: { kind: string; label: string | null; url: string }[];
  try {
    const body = obj(await request.json());
    price = money(body.price, "Your price");
    days = Number(body.days);
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new RequestError("Enter the delivery time in days (1 to 365).");
    message = text(body.message, "Your message", 20, 1500);
    const rawLinks = Array.isArray(body.links) ? body.links : [];
    if (rawLinks.length > MAX_APPLICATION_LINKS) throw new RequestError(`You can add up to ${MAX_APPLICATION_LINKS} links.`);
    links = parseDeliveryLinks(JSON.stringify(rawLinks));
  } catch (err) {
    if (err instanceof RequestError || err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const conn = await getPool().getConnection();
  try {
    await sweepJobs();
    await conn.beginTransaction();
    // Serialises this creator's applications, so two quick clicks cannot pass the monthly limit together
    const [profile] = await conn.query(
      `SELECT p.category_id FROM creator_profiles p
         JOIN users u ON u.id = p.user_id AND u.deleted_at IS NULL AND u.status = 'active'
        WHERE p.user_id = ? FOR UPDATE`,
      [me.id]
    );
    const mine = (profile as { category_id: number }[])[0];
    if (!mine) {
      await conn.rollback();
      return NextResponse.json({ error: "Finish your creator profile before applying." }, { status: 403 });
    }

    const access = await creatorJobAccess(me.id);
    if (!access.canBrowse) {
      await conn.rollback();
      return NextResponse.json({ error: "Applying to jobs needs the Pro or Max plan. Upgrade your membership." }, { status: 403 });
    }
    if (access.remaining !== null && access.remaining <= 0) {
      await conn.rollback();
      return NextResponse.json(
        { error: `You used all ${access.limit} applications of this month. Upgrade to Max for unlimited applications.` },
        { status: 403 }
      );
    }

    const [jobRows] = await conn.query(
      "SELECT id, client_id, category_id FROM job_posts WHERE id = ? AND status = 'open' AND expires_at > UTC_TIMESTAMP(3)",
      [id]
    );
    const job = (jobRows as { id: string; client_id: string; category_id: number }[])[0];
    if (!job) {
      await conn.rollback();
      return NextResponse.json({ error: "This job is no longer open." }, { status: 404 });
    }
    if (job.client_id === me.id) {
      await conn.rollback();
      return NextResponse.json({ error: "You cannot apply to your own job." }, { status: 403 });
    }
    // Members of the top plan (unlimited applications) may apply outside their specialty; the page only shows a note
    if (job.category_id !== mine.category_id && access.limit !== null) {
      await conn.rollback();
      return NextResponse.json(
        { error: "This job is outside your specialty. Creators on the Max plan can apply to jobs in any specialty." },
        { status: 403 }
      );
    }

    await conn.query(
      "INSERT INTO job_applications (id, job_id, creator_id, price, days, message, links) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [randomUUID(), id, me.id, price, days, message, JSON.stringify(links)]
    );
    await conn.commit();
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    await conn.rollback().catch(() => {});
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "You already applied to this job." }, { status: 409 });
    }
    console.error("apply to job failed:", err);
    return NextResponse.json({ error: "Could not send your application." }, { status: 500 });
  } finally {
    conn.release();
  }
}
