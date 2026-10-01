import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { execute, getPool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { DEFAULT_REVISIONS } from "@/lib/deliveries";
import { PAYMENT_WINDOW_HOURS } from "@/lib/payments/config";
import { isUuid } from "@/lib/custom-requests";
import { sweepJobs } from "@/lib/jobs";

// Moves an application along:
//   creator: withdraw (while it is under review)
//   client:  reject, accept (the job is filled, the other applications close, and an order is created that waits for payment)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  if (!["withdraw", "reject", "accept"].includes(action)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const conflict = () => NextResponse.json({ error: "This application has already changed. Please refresh the page." }, { status: 409 });

  try {
    await sweepJobs();

    if (action === "withdraw") {
      if (me.role !== "creator") return NextResponse.json({ error: "You cannot do this." }, { status: 403 });
      const r = await execute(
        "UPDATE job_applications SET status = 'withdrawn' WHERE id = ? AND creator_id = ? AND status = 'pending'",
        [id, me.id]
      );
      if (r.affectedRows > 0) return NextResponse.json({ ok: true });
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    if (me.role !== "client") return NextResponse.json({ error: "You cannot do this." }, { status: 403 });

    if (action === "reject") {
      const r = await execute(
        `UPDATE job_applications a JOIN job_posts j ON j.id = a.job_id
            SET a.status = 'rejected'
          WHERE a.id = ? AND j.client_id = ? AND a.status = 'pending'`,
        [id, me.id]
      );
      return r.affectedRows > 0 ? NextResponse.json({ ok: true }) : conflict();
    }

    // accept: one transaction, so two quick clicks (or two applications) can never create two orders
    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        `SELECT a.job_id, a.creator_id, a.price, a.days, a.status AS app_status,
                j.client_id, j.title, j.summary, j.brief, j.status AS job_status, j.expires_at > UTC_TIMESTAMP(3) AS live
           FROM job_applications a JOIN job_posts j ON j.id = a.job_id
          WHERE a.id = ? AND j.client_id = ? FOR UPDATE`,
        [id, me.id]
      );
      const app = (
        rows as {
          job_id: string; creator_id: string; price: string; days: number; app_status: string;
          client_id: string; title: string; summary: string; brief: string | null; job_status: string; live: number;
        }[]
      )[0];
      if (!app) {
        await conn.rollback();
        return NextResponse.json({ error: "Application not found." }, { status: 404 });
      }
      if (app.app_status !== "pending" || app.job_status !== "open" || !app.live) {
        await conn.rollback();
        return conflict();
      }

      const orderId = randomUUID();
      const brief = [app.summary, app.brief].filter(Boolean).join("\n\n").slice(0, 4000);
      await conn.query(
        `INSERT INTO orders (id, client_id, creator_id, service_id, title, brief, amount, currency, status,
                             payment_due_at, due_date, revisions_allowed)
         VALUES (?, ?, ?, NULL, ?, ?, ?, 'LYD', 'awaiting_payment',
                 DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? HOUR), DATE_ADD(UTC_DATE(), INTERVAL ? DAY), ?)`,
        [orderId, app.client_id, app.creator_id, app.title, brief || null, app.price, PAYMENT_WINDOW_HOURS, app.days, DEFAULT_REVISIONS]
      );
      await conn.query("UPDATE job_applications SET status = 'accepted', order_id = ? WHERE id = ?", [orderId, id]);
      await conn.query("UPDATE job_applications SET status = 'rejected' WHERE job_id = ? AND id <> ? AND status = 'pending'", [app.job_id, id]);
      await conn.query("UPDATE job_posts SET status = 'filled' WHERE id = ?", [app.job_id]);
      await conn.commit();
      return NextResponse.json({ ok: true, orderId });
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("application action failed:", err);
    return NextResponse.json({ error: "Could not update the application." }, { status: 500 });
  }
}
