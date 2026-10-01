import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { execute, getPool, queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { DEFAULT_REVISIONS } from "@/lib/deliveries";
import { PAYMENT_WINDOW_HOURS } from "@/lib/payments/config";
import { expireRequests, isUuid } from "@/lib/custom-requests";
import { REQUEST_OFFER_DAYS } from "@/lib/request-status";

type Action = "offer" | "decline" | "accept" | "cancel";
const ACTIONS: Action[] = ["offer", "decline", "accept", "cancel"];

// Moves a custom request along:
//   creator: offer (a price and a delivery time; can be sent again while the client has not answered), decline.
//   client:  accept (creates the order, which then waits for payment like any other), cancel.
// Every change only applies from the expected status, so two quick clicks cannot clash.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const action = String(body?.action ?? "") as Action;
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const note = String(body?.note ?? "").trim();
  if (note.length > 1000) return NextResponse.json({ error: "The message is too long (max 1000 characters)." }, { status: 400 });

  try {
    await expireRequests();

    const req = await queryOne<
      RowDataPacket & {
        client_id: string; creator_id: string; base_service_id: string | null; title: string; summary: string;
        brief: string | null; revisions: number; offer_price: string | null; offer_days: number | null; status: string;
      }
    >(
      `SELECT client_id, creator_id, base_service_id, title, summary, brief, revisions, offer_price, offer_days, status
         FROM custom_requests WHERE id = ? AND (client_id = ? OR creator_id = ?)`,
      [id, me.id, me.id]
    );
    if (!req) return NextResponse.json({ error: "Request not found." }, { status: 404 });

    const isCreator = req.creator_id === me.id;
    const isClient = req.client_id === me.id;
    const allowed = (action === "offer" || action === "decline") ? isCreator : isClient;
    if (!allowed) return NextResponse.json({ error: "You cannot do this on this request." }, { status: 403 });

    const conflict = () =>
      NextResponse.json({ error: "This request has already changed. Please refresh the page." }, { status: 409 });

    if (action === "offer") {
      const price = Number(body.price);
      const days = Number(body.days);
      if (!Number.isFinite(price) || price < 1 || price > 1_000_000) {
        return NextResponse.json({ error: "Enter a price between 1 and 1,000,000 LYD." }, { status: 400 });
      }
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        return NextResponse.json({ error: "Enter the delivery time in days (1 to 365)." }, { status: 400 });
      }
      const r = await execute(
        `UPDATE custom_requests
            SET status = 'offered', offer_price = ?, offer_days = ?, offer_message = ?,
                expires_at = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? DAY)
          WHERE id = ? AND status IN ('open','offered')`,
        [Math.round(price * 100) / 100, days, note || null, REQUEST_OFFER_DAYS, id]
      );
      return r.affectedRows === 0 ? conflict() : NextResponse.json({ ok: true });
    }

    if (action === "decline") {
      const r = await execute(
        "UPDATE custom_requests SET status = 'declined', decline_note = ? WHERE id = ? AND status IN ('open','offered')",
        [note || null, id]
      );
      return r.affectedRows === 0 ? conflict() : NextResponse.json({ ok: true });
    }

    if (action === "cancel") {
      const r = await execute(
        "UPDATE custom_requests SET status = 'cancelled' WHERE id = ? AND status IN ('open','offered')",
        [id]
      );
      return r.affectedRows === 0 ? conflict() : NextResponse.json({ ok: true });
    }

    // accept: the offer becomes an order waiting for payment, in one transaction
    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      const [claimed] = await conn.query(
        `UPDATE custom_requests SET status = 'accepted'
          WHERE id = ? AND status = 'offered' AND offer_price IS NOT NULL AND expires_at > UTC_TIMESTAMP(3)`,
        [id]
      );
      if ((claimed as { affectedRows: number }).affectedRows === 0) {
        await conn.rollback();
        return conflict();
      }
      const orderId = randomUUID();
      const brief = [req.summary, req.brief].filter(Boolean).join("\n\n").slice(0, 4000);
      await conn.query(
        `INSERT INTO orders (id, client_id, creator_id, service_id, title, brief, amount, currency, status,
                             payment_due_at, due_date, revisions_allowed)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'LYD', 'awaiting_payment',
                 DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? HOUR), DATE_ADD(UTC_DATE(), INTERVAL ? DAY), ?)`,
        [
          orderId, req.client_id, req.creator_id, req.base_service_id, req.title, brief || null,
          req.offer_price, PAYMENT_WINDOW_HOURS, req.offer_days, req.revisions ?? DEFAULT_REVISIONS,
        ]
      );
      await conn.query("UPDATE custom_requests SET order_id = ? WHERE id = ?", [orderId, id]);
      await conn.commit();
      return NextResponse.json({ ok: true, orderId });
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("custom request action failed:", err);
    return NextResponse.json({ error: "Could not update the request." }, { status: 500 });
  }
}
