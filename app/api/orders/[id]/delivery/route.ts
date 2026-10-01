import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getPool, query, queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import {
  DEFAULT_REVISIONS,
  INLINE_IMAGE_EXTENSIONS,
  MAX_DELIVERY_FILES,
  extensionOf,
  parseDeliveryLinks,
  saveDeliveryFile,
} from "@/lib/deliveries";
import { removeFiles, UploadError } from "@/lib/uploads";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface OrderRow extends RowDataPacket {
  id: string;
  order_number: string;
  title: string;
  status: string;
  client_id: string;
  creator_id: string;
  revisions_allowed: number | null;
  revisions_used: number;
  creator_name: string;
}

// The work delivered on an order, with the revision requests and problem reports around it.
// Visible to the client, the creator and admins.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  try {
    const order = await queryOne<OrderRow>(
      `SELECT o.id, o.order_number, o.title, o.status, o.client_id, o.creator_id, o.revisions_allowed, o.revisions_used,
              cr.name AS creator_name
         FROM orders o JOIN users cr ON cr.id = o.creator_id
        WHERE o.id = ?`,
      [id]
    );
    const allowed = order && (me.role === "admin" || order.client_id === me.id || order.creator_id === me.id);
    if (!order || !allowed) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const [deliveries, files, links, notes] = await Promise.all([
      query<RowDataPacket & { id: string; round: number; message: string | null; access_note: string | null; created_at: Date }>(
        "SELECT id, round, message, access_note, created_at FROM deliveries WHERE order_id = ? ORDER BY round",
        [id]
      ),
      query<RowDataPacket & { delivery_id: string; file_id: string; original_name: string; size_bytes: string }>(
        `SELECT df.delivery_id, df.file_id, f.original_name, f.size_bytes
           FROM delivery_files df
           JOIN deliveries d ON d.id = df.delivery_id
           JOIN files f ON f.id = df.file_id
          WHERE d.order_id = ? ORDER BY df.sort_order`,
        [id]
      ),
      query<RowDataPacket & { delivery_id: string; kind: string; label: string | null; url: string }>(
        `SELECT dl.delivery_id, dl.kind, dl.label, dl.url
           FROM delivery_links dl JOIN deliveries d ON d.id = dl.delivery_id
          WHERE d.order_id = ? ORDER BY dl.sort_order`,
        [id]
      ),
      query<RowDataPacket & { kind: string; body: string; created_at: Date; author_id: string | null }>(
        "SELECT kind, body, created_at, author_id FROM order_notes WHERE order_id = ? ORDER BY created_at, id",
        [id]
      ),
    ]);

    const timeline = [
      ...deliveries.map((d) => ({
        type: "delivery" as const,
        at: d.created_at.toISOString(),
        round: d.round,
        message: d.message ?? "",
        accessNote: d.access_note ?? "",
        files: files
          .filter((f) => f.delivery_id === d.id)
          .map((f) => ({
            id: f.file_id,
            name: f.original_name,
            size: Number(f.size_bytes),
            isImage: INLINE_IMAGE_EXTENSIONS.includes(extensionOf(f.original_name)),
          })),
        links: links.filter((l) => l.delivery_id === d.id).map((l) => ({ kind: l.kind, label: l.label, url: l.url })),
      })),
      ...notes.map((n) => ({
        type: "note" as const,
        at: n.created_at.toISOString(),
        kind: n.kind,
        body: n.body,
        // who wrote it, from the viewer's point of view
        by:
          n.kind === "dispute_resolution"
            ? "admin"
            : n.author_id === order.client_id
              ? "client"
              : n.author_id === order.creator_id
                ? "creator"
                : "admin",
      })),
    ].sort((a, b) => a.at.localeCompare(b.at));

    const allowedRevisions = order.revisions_allowed ?? DEFAULT_REVISIONS;
    return NextResponse.json({
      order: {
        number: order.order_number,
        title: order.title,
        creatorName: order.creator_name,
        status: order.status,
        revisionsLeft: Math.max(allowedRevisions - order.revisions_used, 0),
        revisionsAllowed: allowedRevisions,
      },
      timeline,
    });
  } catch (err) {
    console.error("load delivery failed:", err);
    return NextResponse.json({ error: "Could not load the delivery." }, { status: 500 });
  }
}

// The creator delivers the work: a message, files and/or links. The order moves to "in review".
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "creator") return NextResponse.json({ error: "Only the creator delivers the work." }, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const message = String(form.get("message") ?? "").trim();
  const accessNote = String(form.get("accessNote") ?? "").trim();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (message.length > 3000) return NextResponse.json({ error: "The message is too long (max 3000 characters)." }, { status: 400 });
  if (accessNote.length > 500) return NextResponse.json({ error: "The access note is too long (max 500 characters)." }, { status: 400 });
  if (files.length > MAX_DELIVERY_FILES) {
    return NextResponse.json({ error: `You can upload up to ${MAX_DELIVERY_FILES} files. Put the rest in a link.` }, { status: 400 });
  }

  const savedIds: string[] = [];
  try {
    const links = parseDeliveryLinks(form.get("links"));
    if (!message && files.length === 0 && links.length === 0) {
      return NextResponse.json({ error: "Add a message, a file or a link to deliver." }, { status: 400 });
    }

    const order = await queryOne<OrderRow>(
      "SELECT id, status, creator_id FROM orders WHERE id = ? AND creator_id = ?",
      [id, me.id]
    );
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status !== "in_progress") {
      return NextResponse.json({ error: "This order is not in progress, so it cannot be delivered now." }, { status: 409 });
    }

    for (const file of files) savedIds.push((await saveDeliveryFile(file, me.id)).id);

    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      const [locked] = await conn.query("SELECT status FROM orders WHERE id = ? AND creator_id = ? FOR UPDATE", [id, me.id]);
      if ((locked as { status: string }[])[0]?.status !== "in_progress") {
        await conn.rollback();
        await removeFiles(savedIds).catch(() => {});
        return NextResponse.json({ error: "This order has already changed. Please refresh the page." }, { status: 409 });
      }

      const [[{ n }]] = (await conn.query("SELECT COUNT(*) AS n FROM deliveries WHERE order_id = ?", [id])) as unknown as [
        [{ n: number }]
      ];
      const deliveryId = randomUUID();
      await conn.query(
        "INSERT INTO deliveries (id, order_id, round, message, access_note) VALUES (?, ?, ?, ?, ?)",
        [deliveryId, id, Number(n) + 1, message || null, accessNote || null]
      );
      for (let i = 0; i < savedIds.length; i++) {
        await conn.query(
          "INSERT INTO delivery_files (id, delivery_id, file_id, sort_order) VALUES (UUID(), ?, ?, ?)",
          [deliveryId, savedIds[i], i]
        );
      }
      for (let i = 0; i < links.length; i++) {
        await conn.query(
          "INSERT INTO delivery_links (id, delivery_id, kind, label, url, sort_order) VALUES (UUID(), ?, ?, ?, ?, ?)",
          [deliveryId, links[i].kind, links[i].label, links[i].url, i]
        );
      }
      // The client now has to review it (the delivery date starts the automatic-approval clock)
      await conn.query("UPDATE orders SET status = 'in_review' WHERE id = ? AND status = 'in_progress'", [id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    // A failed delivery must not leave uploaded files behind
    if (savedIds.length) await removeFiles(savedIds).catch(() => {});
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("deliver failed:", err);
    return NextResponse.json({ error: "Could not deliver the work." }, { status: 500 });
  }
}
