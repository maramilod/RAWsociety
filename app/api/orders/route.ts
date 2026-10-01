import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { execute, query, queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { runOrderSweeps } from "@/lib/order-sweeps";
import { DEFAULT_REVISIONS } from "@/lib/deliveries";
import { CLIENT_INFO_COLUMNS, CLIENT_INFO_JOINS, toClientInfo, type ClientInfoRow } from "@/lib/client-info";
import type { CancelledBy, OrderRow, OrderStatus, PayoutStatus } from "@/lib/order-status";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NOTE = 1000;
const MAX_OPEN_REQUESTS = 10; // a client can wait on this many pending requests at once

interface DbOrder extends RowDataPacket, Partial<Omit<ClientInfoRow, keyof RowDataPacket>> {
  id: string;
  order_number: string;
  title: string;
  brief: string | null;
  amount: string;
  currency: string;
  status: OrderStatus;
  cancelled_by: CancelledBy | null;
  due_date: Date | null;
  payment_due_at: Date | null;
  payout_status: PayoutStatus;
  platform_fee: string | null;
  creator_payout: string | null;
  last_payment_status: string | null;
  last_payment_note: string | null;
  delivery_count: number;
  revisions_left: number;
  note_kind: "revision_request" | "dispute" | "dispute_resolution" | null;
  note_body: string | null;
  review_rating: number | null;
  review_comment: string | null;
  created_at: Date;
  service_id: string | null;
  other_id: string;
  other_name: string;
  other_image: string | null;
  other_sub: string | null;
}

// Columns both lists need, including the state of the most recent payment of each order
const ORDER_COLUMNS = `o.id, o.order_number, o.title, o.brief, o.amount, o.currency, o.status, o.cancelled_by,
  o.due_date, o.payment_due_at, o.payout_status, o.platform_fee, o.creator_payout, o.created_at, o.service_id,
  (SELECT p.status FROM payments p WHERE p.order_id = o.id ORDER BY p.created_at DESC LIMIT 1) AS last_payment_status,
  (SELECT p.failure_reason FROM payments p WHERE p.order_id = o.id ORDER BY p.created_at DESC LIMIT 1) AS last_payment_note,
  (SELECT COUNT(*) FROM deliveries d WHERE d.order_id = o.id) AS delivery_count,
  GREATEST(COALESCE(o.revisions_allowed, ${DEFAULT_REVISIONS}) - o.revisions_used, 0) AS revisions_left,
  (SELECT n.kind FROM order_notes n WHERE n.order_id = o.id ORDER BY n.created_at DESC, n.id DESC LIMIT 1) AS note_kind,
  (SELECT n.body FROM order_notes n WHERE n.order_id = o.id ORDER BY n.created_at DESC, n.id DESC LIMIT 1) AS note_body,
  (SELECT r.rating FROM reviews r WHERE r.order_id = o.id) AS review_rating,
  (SELECT r.comment FROM reviews r WHERE r.order_id = o.id) AS review_comment`;

function toRow(o: DbOrder, withClient = false): OrderRow {
  return {
    id: o.id,
    number: o.order_number,
    title: o.title,
    brief: o.brief ?? "",
    amount: Number(o.amount),
    currency: o.currency,
    status: o.status,
    cancelledBy: o.cancelled_by,
    dueDate: o.due_date ? o.due_date.toISOString().slice(0, 10) : null,
    paymentDueAt: o.payment_due_at ? o.payment_due_at.toISOString() : null,
    paymentState:
      o.last_payment_status === "pending" ? "pending" : o.last_payment_status === "failed" ? "rejected" : "none",
    paymentNote: o.last_payment_status === "failed" ? o.last_payment_note : null,
    payoutStatus: o.payout_status,
    platformFee: o.platform_fee !== null ? Number(o.platform_fee) : null,
    creatorPayout: o.creator_payout !== null ? Number(o.creator_payout) : null,
    createdAt: o.created_at.toISOString(),
    serviceId: o.service_id,
    deliveryCount: Number(o.delivery_count),
    revisionsLeft: Number(o.revisions_left),
    latestNote: o.note_kind && o.note_body ? { kind: o.note_kind, body: o.note_body } : null,
    review: o.review_rating ? { rating: Number(o.review_rating), comment: o.review_comment ?? "" } : null,
    other: { id: o.other_id, name: o.other_name, image: o.other_image, subtitle: o.other_sub },
    client: withClient && o.ci_joined ? toClientInfo(o as unknown as ClientInfoRow) : null,
  };
}

// The logged-in user's orders plus the numbers for the dashboard cards
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "client" && me.role !== "creator") {
    return NextResponse.json({ error: "Not available for this account." }, { status: 403 });
  }

  try {
    await runOrderSweeps();

    if (me.role === "client") {
      const [rows, [stats], [saved]] = await Promise.all([
        query<DbOrder>(
          `SELECT ${ORDER_COLUMNS},
                  u.id AS other_id, u.name AS other_name, u.image AS other_image, cat.name AS other_sub
             FROM orders o
             JOIN users u ON u.id = o.creator_id
             LEFT JOIN creator_profiles cp ON cp.user_id = o.creator_id
             LEFT JOIN categories cat ON cat.id = cp.category_id
            WHERE o.client_id = ?
            ORDER BY o.created_at DESC LIMIT 200`,
          [me.id]
        ),
        query<RowDataPacket>(
          `SELECT SUM(status IN ('pending','awaiting_payment','in_progress','in_review')) AS active,
                  SUM(CASE WHEN paid_at IS NOT NULL THEN amount ELSE 0 END) AS investment,
                  SUM(status = 'pending') AS pending,
                  SUM(status = 'awaiting_payment') AS to_pay,
                  COUNT(DISTINCT CASE WHEN paid_at IS NOT NULL THEN creator_id END) AS hired
             FROM orders WHERE client_id = ?`,
          [me.id]
        ),
        query<RowDataPacket>("SELECT COUNT(*) AS n FROM saved_creators WHERE client_id = ?", [me.id]),
      ]);
      return NextResponse.json({
        role: "client",
        orders: rows.map((o) => toRow(o)),
        stats: {
          active: Number(stats.active ?? 0),
          pending: Number(stats.pending ?? 0),
          toPay: Number(stats.to_pay ?? 0),
          investment: Number(stats.investment ?? 0),
          hired: Number(stats.hired ?? 0),
          saved: Number(saved.n ?? 0),
        },
      });
    }

    const [rows, [stats], profile] = await Promise.all([
      query<DbOrder>(
        `SELECT ${ORDER_COLUMNS},
                u.id AS other_id, u.name AS other_name, u.image AS other_image, clp.company_name AS other_sub,
                ${CLIENT_INFO_COLUMNS}
           FROM orders o
           JOIN users u ON u.id = o.client_id
           ${CLIENT_INFO_JOINS}
          WHERE o.creator_id = ?
          ORDER BY o.created_at DESC LIMIT 200`,
        [me.id]
      ),
      query<RowDataPacket>(
        `SELECT SUM(status = 'pending') AS requests,
                SUM(status = 'awaiting_payment') AS awaiting_payment,
                SUM(status IN ('in_progress','in_review')) AS active,
                SUM(status = 'completed') AS completed,
                SUM(CASE WHEN payout_status IN ('released','paid_out') THEN creator_payout ELSE 0 END) AS revenue,
                SUM(CASE WHEN payout_status = 'held' THEN creator_payout ELSE 0 END) AS escrow
           FROM orders WHERE creator_id = ?`,
        [me.id]
      ),
      queryOne<RowDataPacket & { rating_avg: string; reviews_count: number }>(
        "SELECT rating_avg, reviews_count FROM creator_profiles WHERE user_id = ?",
        [me.id]
      ),
    ]);
    return NextResponse.json({
      role: "creator",
      orders: rows.map((o) => toRow(o, true)),
      stats: {
        requests: Number(stats.requests ?? 0),
        awaitingPayment: Number(stats.awaiting_payment ?? 0),
        active: Number(stats.active ?? 0),
        completed: Number(stats.completed ?? 0),
        revenue: Number(stats.revenue ?? 0),
        escrow: Number(stats.escrow ?? 0),
        rating: profile ? Number(profile.rating_avg) : 0,
        reviews: profile ? profile.reviews_count : 0,
      },
    });
  } catch (err) {
    console.error("list orders failed:", err);
    return NextResponse.json({ error: "Could not load your orders." }, { status: 500 });
  }
}

// A client books a service: creates a pending request for the creator to answer
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "client") {
    return NextResponse.json({ error: "Only client accounts can book services." }, { status: 403 });
  }

  let serviceId = "";
  let note = "";
  try {
    const body = await request.json();
    serviceId = String(body?.serviceId ?? "");
    note = String(body?.note ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!UUID_RE.test(serviceId)) return NextResponse.json({ error: "Service not found." }, { status: 404 });
  if (note.length > MAX_NOTE) {
    return NextResponse.json({ error: `The message is too long (max ${MAX_NOTE} characters).` }, { status: 400 });
  }

  try {
    // Only live services of public, active creators can be booked
    const service = await queryOne<
      RowDataPacket & { id: string; creator_id: string; title: string; price: string; currency: string; revisions: number | null }
    >(
      `SELECT s.id, s.creator_id, s.title, s.price, s.currency, s.revisions
         FROM services s
         JOIN creator_profiles p ON p.user_id = s.creator_id AND p.is_public = 1
         JOIN users u ON u.id = s.creator_id AND u.deleted_at IS NULL AND u.status = 'active'
        WHERE s.id = ? AND s.is_active = 1`,
      [serviceId]
    );
    if (!service) return NextResponse.json({ error: "This service is no longer available." }, { status: 404 });

    const open = await queryOne<RowDataPacket>(
      `SELECT id FROM orders
        WHERE client_id = ? AND service_id = ?
          AND status IN ('pending','awaiting_payment','in_progress','in_review')`,
      [me.id, serviceId]
    );
    if (open) {
      return NextResponse.json(
        { error: "You already have an open request for this service. You can follow it in your dashboard." },
        { status: 409 }
      );
    }

    const pending = await queryOne<RowDataPacket & { n: number }>(
      "SELECT COUNT(*) AS n FROM orders WHERE client_id = ? AND status = 'pending'",
      [me.id]
    );
    if ((pending?.n ?? 0) >= MAX_OPEN_REQUESTS) {
      return NextResponse.json(
        { error: "You have too many requests waiting for approval. Please wait for some replies first." },
        { status: 429 }
      );
    }

    // The order keeps its own copy of the title and price, so later edits do not change it
    const id = randomUUID();
    await execute(
      `INSERT INTO orders (id, client_id, creator_id, service_id, title, brief, amount, currency, status, revisions_allowed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        id, me.id, service.creator_id, service.id, service.title, note || null,
        service.price, service.currency, service.revisions ?? DEFAULT_REVISIONS,
      ]
    );
    const created = await queryOne<RowDataPacket & { order_number: string }>(
      "SELECT order_number FROM orders WHERE id = ?",
      [id]
    );
    return NextResponse.json({ id, number: created?.order_number }, { status: 201 });
  } catch (err) {
    console.error("create order failed:", err);
    return NextResponse.json({ error: "Could not send your request." }, { status: 500 });
  }
}
