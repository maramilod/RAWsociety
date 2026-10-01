import { NextResponse } from "next/server";
import { execute, query, queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import {
  SERVICE_COLUMNS,
  hydrateServices,
  parseServiceInput,
  type ServiceRow,
} from "@/lib/services";
import { deleteService, getOwnedServiceId, updateService } from "@/lib/service-store";
import { readServiceRequest } from "@/lib/service-request";
import { UploadError } from "@/lib/uploads";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only the creator who owns the service may change it
async function loadOwned(id: string) {
  const me = await getSessionUser();
  if (!me) return { error: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  if (me.role !== "creator") {
    return { error: NextResponse.json({ error: "Only creator accounts can manage services." }, { status: 403 }) };
  }
  if (!UUID_RE.test(id) || !(await getOwnedServiceId(id, me.id))) {
    return { error: NextResponse.json({ error: "Service not found." }, { status: 404 }) };
  }
  return { me };
}

interface DetailRow extends ServiceRow {
  creator_name: string;
  creator_image: string | null;
  creator_role: string;
}

// Public detail of a live service (for the detail window on Explore and on profiles)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Service not found." }, { status: 404 });

  try {
    const row = await queryOne<DetailRow>(
      `SELECT ${SERVICE_COLUMNS},
              u.name AS creator_name, u.image AS creator_image, cat.name AS creator_role
         FROM services s
         JOIN categories c ON c.id = s.category_id
         JOIN creator_profiles p ON p.user_id = s.creator_id AND p.is_public = 1
         JOIN categories cat ON cat.id = p.category_id
         JOIN users u ON u.id = s.creator_id AND u.deleted_at IS NULL AND u.status = 'active'
        WHERE s.id = ? AND s.is_active = 1`,
      [id]
    );
    if (!row) return NextResponse.json({ error: "Service not found." }, { status: 404 });

    const [service] = await hydrateServices([row]);

    // What clients said about this service (newest first)
    const reviewRows = await query<RowDataPacket & { id: string; client_name: string; rating: number; comment: string | null; created_at: Date }>(
      `SELECT r.id, u.name AS client_name, r.rating, r.comment, r.created_at
         FROM reviews r
         JOIN orders o ON o.id = r.order_id
         JOIN users u ON u.id = r.client_id
        WHERE o.service_id = ?
        ORDER BY r.created_at DESC
        LIMIT 20`,
      [id]
    );
    // "Maram Milod" -> "Maram M."  (clients' full names are not shown publicly)
    const shortName = (name: string) => {
      const parts = name.trim().split(/\s+/);
      return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
    };

    return NextResponse.json({
      service,
      reviews: reviewRows.map((r) => ({
        id: r.id,
        client: shortName(r.client_name),
        rating: r.rating,
        comment: r.comment ?? "",
        date: r.created_at,
      })),
      creator: {
        id: row.creator_id,
        name: row.creator_name,
        image: row.creator_image,
        role: row.creator_role,
      },
    });
  } catch (err) {
    console.error("service detail failed:", err);
    return NextResponse.json({ error: "Could not load this service." }, { status: 500 });
  }
}

// Edit a service (multipart), or pause/resume it with JSON { isActive }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const owned = await loadOwned(id);
  if (owned.error) return owned.error;

  const req = await readServiceRequest(request);
  if (!req) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    // Quick toggle: only { isActive }
    const keys = Object.keys(req.fields);
    if (keys.length === 1 && keys[0] === "isActive") {
      await execute("UPDATE services SET is_active = ? WHERE id = ?", [req.fields.isActive ? 1 : 0, id]);
      return NextResponse.json({ ok: true });
    }

    const parsed = await parseServiceInput(req.fields);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    await updateService(owned.me.id, id, parsed.data, req.images, req.order);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("update service failed:", err);
    return NextResponse.json({ error: "Could not update the service." }, { status: 500 });
  }
}

// Delete a service and its images (past orders keep their own title and price)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const owned = await loadOwned(id);
  if (owned.error) return owned.error;

  try {
    await deleteService(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete service failed:", err);
    return NextResponse.json({ error: "Could not delete the service." }, { status: 500 });
  }
}

