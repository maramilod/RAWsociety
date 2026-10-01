import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { execute, queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { runOrderSweeps } from "@/lib/order-sweeps";
import { PAYMENT_WINDOW_HOURS } from "@/lib/payments/config";
import { DEFAULT_REVISIONS } from "@/lib/deliveries";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Action = "accept" | "decline" | "cancel" | "approve" | "revision" | "dispute";
const ACTIONS: Action[] = ["accept", "decline", "cancel", "approve", "revision", "dispute"];

// Moves an order along its path:
//   creator: accept (then the client must pay), decline.
//            (Delivering the work is done through POST /api/orders/[id]/delivery.)
//   client:  cancel (before paying), approve (after delivery: releases the money to the creator),
//            revision (asks the creator to change something), dispute (reports a problem to the admin)
// Every change only applies from the expected status, so two quick clicks cannot clash.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  let action = "";
  let note = "";
  try {
    const body = await request.json();
    action = String(body?.action ?? "");
    note = String(body?.note ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  try {
    await runOrderSweeps();

    // The order must belong to this user, in the right role
    const order = await queryOne<RowDataPacket & { client_id: string; creator_id: string }>(
      "SELECT client_id, creator_id FROM orders WHERE id = ? AND (client_id = ? OR creator_id = ?)",
      [id, me.id, me.id]
    );
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const isCreator = order.creator_id === me.id;
    const isClient = order.client_id === me.id;

    // The two actions that need a written reason are checked first
    if (action === "revision" && isClient) {
      if (note.length < 5 || note.length > 1000) {
        return NextResponse.json({ error: "Please explain what should change (5 to 1000 characters)." }, { status: 400 });
      }
    }
    if (action === "dispute" && isClient) {
      if (note.length < 10 || note.length > 1000) {
        return NextResponse.json({ error: "Please describe the problem (10 to 1000 characters)." }, { status: 400 });
      }
    }

    let result;
    if (action === "accept" && isCreator) {
      // The client now has PAYMENT_WINDOW_HOURS to pay
      result = await execute(
        `UPDATE orders
            SET status = 'awaiting_payment',
                payment_due_at = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? HOUR)
          WHERE id = ? AND status = 'pending'`,
        [PAYMENT_WINDOW_HOURS, id]
      );
    } else if (action === "decline" && isCreator) {
      result = await execute(
        "UPDATE orders SET status = 'cancelled', cancelled_by = 'creator' WHERE id = ? AND status = 'pending'",
        [id]
      );
    } else if (action === "cancel" && isClient) {
      // Before paying only. If a payment is waiting for the admin the money may already be sent, so no cancelling.
      result = await execute(
        `UPDATE orders
            SET status = 'cancelled', cancelled_by = 'client'
          WHERE id = ?
            AND (status = 'pending'
                 OR (status = 'awaiting_payment'
                     AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = orders.id AND p.status = 'pending')))`,
        [id]
      );
    } else if (action === "approve" && isClient) {
      // Approving releases the held money to the creator
      result = await execute(
        `UPDATE orders
            SET status = 'completed',
                payout_status = IF(payout_status = 'held', 'released', payout_status)
          WHERE id = ? AND status = 'in_review'`,
        [id]
      );
    } else if (action === "revision" && isClient) {
      // Back to the creator, while revisions are left. The delivery date is cleared so the
      // automatic-approval clock starts again with the next delivery.
      result = await execute(
        `UPDATE orders
            SET status = 'in_progress', revisions_used = revisions_used + 1, delivered_at = NULL
          WHERE id = ? AND status = 'in_review' AND revisions_used < COALESCE(revisions_allowed, ?)`,
        [id, DEFAULT_REVISIONS]
      );
      if (result.affectedRows === 0) {
        const state = await queryOne<RowDataPacket & { status: string }>("SELECT status FROM orders WHERE id = ?", [id]);
        if (state?.status === "in_review") {
          return NextResponse.json(
            { error: "You have used all the revisions of this order. You can approve the work or report a problem." },
            { status: 409 }
          );
        }
      }
    } else if (action === "dispute" && isClient) {
      result = await execute("UPDATE orders SET status = 'disputed' WHERE id = ? AND status = 'in_review'", [id]);
    } else {
      return NextResponse.json({ error: "You cannot do that with this order." }, { status: 403 });
    }

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "This order has already changed, or this step is not available now. Please refresh the page." },
        { status: 409 }
      );
    }

    if (action === "revision" || action === "dispute") {
      await execute("INSERT INTO order_notes (id, order_id, author_id, kind, body) VALUES (?, ?, ?, ?, ?)", [
        randomUUID(),
        id,
        me.id,
        action === "revision" ? "revision_request" : "dispute",
        note,
      ]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("update order failed:", err);
    return NextResponse.json({ error: "Could not update the order." }, { status: 500 });
  }
}
