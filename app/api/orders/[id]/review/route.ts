import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { execute, queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { runOrderSweeps } from "@/lib/order-sweeps";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_COMMENT = 1000;

// The client rates the creator after the work was approved. One review per order, and it cannot be changed.
// The database keeps the creator's average rating and review count up to date by itself.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "client") return NextResponse.json({ error: "Only the client can review the work." }, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  let rating = 0;
  let comment = "";
  try {
    const body = await request.json();
    rating = Number(body?.rating);
    comment = String(body?.comment ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Please choose a rating from 1 to 5 stars." }, { status: 400 });
  }
  if (comment.length > MAX_COMMENT) {
    return NextResponse.json({ error: `The comment is too long (max ${MAX_COMMENT} characters).` }, { status: 400 });
  }

  try {
    // A delivery the client never answered is approved by the system; do that first so it can be reviewed
    await runOrderSweeps();

    const order = await queryOne<RowDataPacket & { creator_id: string; status: string }>(
      "SELECT creator_id, status FROM orders WHERE id = ? AND client_id = ?",
      [id, me.id]
    );
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status !== "completed") {
      return NextResponse.json({ error: "You can review an order after the work is approved." }, { status: 409 });
    }

    await execute(
      "INSERT INTO reviews (id, order_id, client_id, creator_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)",
      [randomUUID(), id, me.id, order.creator_id, rating, comment || null]
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "You already reviewed this order." }, { status: 409 });
    }
    console.error("create review failed:", err);
    return NextResponse.json({ error: "Could not save your review." }, { status: 500 });
  }
}
