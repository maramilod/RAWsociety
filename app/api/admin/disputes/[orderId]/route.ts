import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The admin's decision on a reported problem:
//   release:  the work is fine, the creator gets the money
//   refund:   the client gets the money back (the admin sends it outside the site)
//   revision: the creator must fix it, the order goes back to "in progress"
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { orderId } = await params;
  if (!UUID_RE.test(orderId)) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  let action = "";
  let note = "";
  try {
    const body = await request.json();
    action = String(body?.action ?? "");
    note = String(body?.note ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!["release", "refund", "revision"].includes(action)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  if (note.length < 3 || note.length > 500) {
    return NextResponse.json(
      { error: "Please write a short explanation (3 to 500 characters). Both sides can read it." },
      { status: 400 }
    );
  }

  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT status FROM orders WHERE id = ? FOR UPDATE", [orderId]);
    if ((rows as { status: string }[])[0]?.status !== "disputed") {
      await conn.rollback();
      return NextResponse.json({ error: "This order is no longer under dispute." }, { status: 409 });
    }

    if (action === "release") {
      await conn.query(
        `UPDATE orders
            SET status = 'completed', payout_status = IF(payout_status = 'held', 'released', payout_status)
          WHERE id = ? AND status = 'disputed'`,
        [orderId]
      );
    } else if (action === "refund") {
      await conn.query(
        "UPDATE orders SET status = 'cancelled', cancelled_by = 'admin', payout_status = 'none' WHERE id = ? AND status = 'disputed'",
        [orderId]
      );
      await conn.query("UPDATE payments SET status = 'refunded' WHERE order_id = ? AND status = 'paid'", [orderId]);
    } else {
      await conn.query(
        "UPDATE orders SET status = 'in_progress', delivered_at = NULL WHERE id = ? AND status = 'disputed'",
        [orderId]
      );
    }
    await conn.query(
      "INSERT INTO order_notes (id, order_id, author_id, kind, body) VALUES (?, ?, ?, 'dispute_resolution', ?)",
      [randomUUID(), orderId, auth.admin.id, note]
    );
    await conn.commit();
    return NextResponse.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error("resolve dispute failed:", err);
    return NextResponse.json({ error: "Could not resolve the dispute." }, { status: 500 });
  } finally {
    conn.release();
  }
}
