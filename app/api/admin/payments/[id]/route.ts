import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { splitAmount } from "@/lib/payments/config";
import { SUBSCRIPTION_DAYS } from "@/lib/plan-rules";
import { removeFiles } from "@/lib/uploads";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Confirm or reject a payment the client reported.
//   confirm: the order starts (In Progress), the money is held by the platform, the commission is worked out
//   reject:  the client is told why and can submit the payment again while the payment window is open
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Payment not found." }, { status: 404 });

  let action = "";
  let reason = "";
  try {
    const body = await request.json();
    action = String(body?.action ?? "");
    reason = String(body?.reason ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (action !== "confirm" && action !== "reject") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  if (action === "reject" && (reason.length < 3 || reason.length > 300)) {
    return NextResponse.json(
      { error: "Please write a short reason (3 to 300 characters) so the client knows what to fix." },
      { status: 400 }
    );
  }

  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    // Lock the payment and its order so two admins cannot confirm the same payment twice
    const [payRows] = await conn.query(
      "SELECT id, order_id, subscription_id, user_id, amount, paid_amount FROM payments WHERE id = ? AND status = 'pending' FOR UPDATE",
      [id]
    );
    const payment = (
      payRows as {
        id: string;
        order_id: string | null;
        subscription_id: string | null;
        user_id: string;
        amount: string;
        paid_amount: string | null;
      }[]
    )[0];
    if (!payment) {
      await conn.rollback();
      return NextResponse.json({ error: "This payment was already handled." }, { status: 409 });
    }

    if (action === "reject") {
      await conn.query(
        `UPDATE payments
            SET status = 'failed', failure_reason = ?, confirmed_by = ?, confirmed_at = UTC_TIMESTAMP(3)
          WHERE id = ?`,
        [reason, auth.admin.id, id]
      );
      // a rejected membership payment ends that request, the user can start again
      let removedLogo: string | null = null;
      if (payment.subscription_id) {
        await conn.query("UPDATE subscriptions SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(3) WHERE id = ? AND status = 'pending'", [
          payment.subscription_id,
        ]);
        // The very first paid plan (chosen at sign-up) was not paid: the user goes back to the free plan,
        // which has no company branding, so the logo they uploaded is removed.
        const [paidRows] = await conn.query(
          "SELECT COUNT(*) AS n FROM subscriptions WHERE user_id = ? AND current_period_start IS NOT NULL",
          [payment.user_id]
        );
        if (Number((paidRows as { n: number }[])[0]?.n ?? 0) === 0) {
          const [logoRows] = await conn.query("SELECT logo_file_id FROM client_profiles WHERE user_id = ?", [payment.user_id]);
          removedLogo = (logoRows as { logo_file_id: string | null }[])[0]?.logo_file_id ?? null;
          if (removedLogo) await conn.query("UPDATE client_profiles SET logo_file_id = NULL WHERE user_id = ?", [payment.user_id]);
          await conn.query(
            "INSERT INTO notifications (id, user_id, type, title, data) VALUES (UUID(), ?, 'payment', ?, ?)",
            [
              payment.user_id,
              "Your payment was not confirmed",
              JSON.stringify({ kind: "onboarding_rejected", reason, logoRemoved: !!removedLogo }),
            ]
          );
        }
      }
      await conn.commit();
      if (removedLogo) await removeFiles([removedLogo]).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    // A membership: the plan runs for SUBSCRIPTION_DAYS from now (or from the end of the same plan, when renewing)
    if (payment.subscription_id) {
      const [subRows] = await conn.query(
        "SELECT id, plan_id FROM subscriptions WHERE id = ? AND status = 'pending' FOR UPDATE",
        [payment.subscription_id]
      );
      const sub = (subRows as { id: string; plan_id: number }[])[0];
      if (!sub) {
        await conn.rollback();
        return NextResponse.json({ error: "This membership request is no longer pending." }, { status: 409 });
      }
      const [planRows] = await conn.query("SELECT price FROM plans WHERE id = ?", [sub.plan_id]);
      const planPrice = Number((planRows as { price: string }[])[0]?.price);
      if (planPrice !== Number(payment.amount)) {
        await conn.rollback();
        return NextResponse.json({ error: "The paid amount does not match the plan price." }, { status: 409 });
      }
      if (payment.paid_amount !== null && Number(payment.paid_amount) < planPrice) {
        await conn.rollback();
        return NextResponse.json(
          { error: "The user reports sending less than the plan price. Reject this payment and ask for the full amount." },
          { status: 409 }
        );
      }

      const [oldRows] = await conn.query(
        `SELECT id, plan_id, current_period_end FROM subscriptions
          WHERE user_id = ? AND status = 'active' AND id <> ? FOR UPDATE`,
        [payment.user_id, sub.id]
      );
      const old = (oldRows as { id: string; plan_id: number; current_period_end: Date | null }[])[0];
      // renewing the same plan keeps the days that are left
      const keepFrom =
        old && old.plan_id === sub.plan_id && old.current_period_end && old.current_period_end.getTime() > Date.now()
          ? old.current_period_end
          : null;
      if (old) {
        await conn.query("UPDATE subscriptions SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(3) WHERE id = ?", [old.id]);
      }
      const start = keepFrom ?? new Date();
      await conn.query(
        `UPDATE subscriptions
            SET status = 'active', current_period_start = ?,
                current_period_end = DATE_ADD(?, INTERVAL ? DAY)
          WHERE id = ?`,
        [start, start, SUBSCRIPTION_DAYS, sub.id]
      );
      await conn.query(
        `UPDATE payments
            SET status = 'paid', paid_at = UTC_TIMESTAMP(3), confirmed_by = ?, confirmed_at = UTC_TIMESTAMP(3)
          WHERE id = ?`,
        [auth.admin.id, id]
      );
      await conn.commit();
      return NextResponse.json({ ok: true });
    }

    if (!payment.order_id) {
      await conn.rollback();
      return NextResponse.json({ error: "This payment has nothing to confirm." }, { status: 409 });
    }

    const [orderRows] = await conn.query(
      "SELECT id, amount, status FROM orders WHERE id = ? FOR UPDATE",
      [payment.order_id]
    );
    const order = (orderRows as { id: string; amount: string; status: string }[])[0];
    if (!order || order.status !== "awaiting_payment") {
      await conn.rollback();
      return NextResponse.json({ error: "This order is no longer waiting for payment." }, { status: 409 });
    }
    if (Number(order.amount) !== Number(payment.amount)) {
      await conn.rollback();
      return NextResponse.json({ error: "The paid amount does not match the order amount." }, { status: 409 });
    }

    // The client reported sending less than the order costs: the admin should reject it and ask for the rest
    if (payment.paid_amount !== null && Number(payment.paid_amount) < Number(order.amount)) {
      await conn.rollback();
      return NextResponse.json(
        { error: "The client reports sending less than the order amount. Reject this payment and ask for the full amount." },
        { status: 409 }
      );
    }

    const { fee, payout } = splitAmount(Number(order.amount));
    await conn.query(
      `UPDATE payments
          SET status = 'paid', paid_at = UTC_TIMESTAMP(3), confirmed_by = ?, confirmed_at = UTC_TIMESTAMP(3)
        WHERE id = ?`,
      [auth.admin.id, id]
    );
    // The work starts now: the delivery time counts from the day the payment is confirmed
    await conn.query(
      `UPDATE orders
          SET status = 'in_progress',
              paid_at = UTC_TIMESTAMP(3),
              payout_status = 'held',
              platform_fee = ?,
              creator_payout = ?,
              due_date = (SELECT DATE_ADD(UTC_DATE(), INTERVAL s.delivery_days DAY)
                            FROM services s WHERE s.id = orders.service_id AND s.delivery_days IS NOT NULL)
        WHERE id = ? AND status = 'awaiting_payment'`,
      [fee, payout, order.id]
    );
    await conn.commit();
    return NextResponse.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error("admin payment action failed:", err);
    return NextResponse.json({ error: "Could not update the payment." }, { status: 500 });
  } finally {
    conn.release();
  }
}
