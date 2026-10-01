import { NextResponse } from "next/server";
import { query, queryOne, type RowDataPacket } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { runOrderSweeps } from "@/lib/order-sweeps";
import { providerLabel } from "@/lib/payments/providers";
import { payoutMethod } from "@/lib/payout-methods";

interface PendingPayment extends RowDataPacket {
  id: string;
  method: string;
  provider_ref: string | null;
  sender_name: string | null;
  sender_bank: string | null;
  paid_amount: string | null;
  has_receipt: number;
  amount: string;
  currency: string;
  created_at: Date;
  order_number: string;
  title: string;
  payment_due_at: Date | null;
  client_name: string;
  client_email: string;
  creator_name: string;
}

interface DisputeRow extends RowDataPacket {
  id: string;
  order_number: string;
  title: string;
  amount: string;
  currency: string;
  reason: string | null;
  reported_at: Date | null;
  client_name: string;
  client_email: string;
  creator_name: string;
  creator_email: string;
}

interface PayoutRow extends RowDataPacket {
  id: string;
  order_number: string;
  title: string;
  amount: string;
  platform_fee: string | null;
  creator_payout: string | null;
  currency: string;
  completed_at: Date | null;
  creator_name: string;
  creator_email: string;
  pd_method: string | null;
  pd_name: string | null;
  pd_number: string | null;
  pd_bank: string | null;
}

// What the admin has to do: payments to confirm, and creators waiting to be paid
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    await runOrderSweeps();

    const [payments, payouts, disputes, totals] = await Promise.all([
      query<PendingPayment>(
        `SELECT p.id, p.method, p.provider_ref, p.sender_name, p.sender_bank, p.paid_amount,
                p.receipt_file_id IS NOT NULL AS has_receipt, p.amount, p.currency, p.created_at,
                COALESCE(o.order_number, CONCAT('PLAN-', UPPER(LEFT(p.user_id, 6)))) AS order_number,
                COALESCE(o.title, CONCAT(pl.name, ' membership (30 days)')) AS title,
                o.payment_due_at,
                cl.name AS client_name, cl.email AS client_email,
                COALESCE(cr.name, 'Membership') AS creator_name
           FROM payments p
           LEFT JOIN orders o ON o.id = p.order_id
           LEFT JOIN subscriptions s ON s.id = p.subscription_id
           LEFT JOIN plans pl ON pl.id = s.plan_id
           JOIN users cl ON cl.id = p.user_id
           LEFT JOIN users cr ON cr.id = o.creator_id
          WHERE p.status = 'pending'
          ORDER BY p.created_at ASC`
      ),
      query<PayoutRow>(
        `SELECT o.id, o.order_number, o.title, o.amount, o.platform_fee, o.creator_payout, o.currency, o.completed_at,
                cr.name AS creator_name, cr.email AS creator_email,
                pd.method AS pd_method, pd.account_name AS pd_name, pd.account_number AS pd_number, pd.bank_name AS pd_bank
           FROM orders o JOIN users cr ON cr.id = o.creator_id
           LEFT JOIN creator_payout_details pd ON pd.user_id = o.creator_id
          WHERE o.payout_status = 'released'
          ORDER BY o.completed_at ASC`
      ),
      query<DisputeRow>(
        `SELECT o.id, o.order_number, o.title, o.amount, o.currency,
                (SELECT n.body FROM order_notes n WHERE n.order_id = o.id AND n.kind = 'dispute'
                  ORDER BY n.created_at DESC LIMIT 1) AS reason,
                (SELECT n.created_at FROM order_notes n WHERE n.order_id = o.id AND n.kind = 'dispute'
                  ORDER BY n.created_at DESC LIMIT 1) AS reported_at,
                cl.name AS client_name, cl.email AS client_email,
                cr.name AS creator_name, cr.email AS creator_email
           FROM orders o
           JOIN users cl ON cl.id = o.client_id
           JOIN users cr ON cr.id = o.creator_id
          WHERE o.status = 'disputed'
          ORDER BY o.updated_at ASC`
      ),
      queryOne<RowDataPacket>(
        `SELECT SUM(CASE WHEN payout_status = 'held' THEN amount ELSE 0 END) AS held,
                SUM(CASE WHEN payout_status IN ('released','paid_out') THEN platform_fee ELSE 0 END) AS earned_fees
           FROM orders`
      ),
    ]);

    return NextResponse.json({
      payments: payments.map((p) => ({
        id: p.id,
        method: p.method,
        methodLabel: providerLabel(p.method),
        reference: p.provider_ref,
        senderName: p.sender_name,
        senderBank: p.sender_bank,
        paidAmount: p.paid_amount !== null ? Number(p.paid_amount) : null,
        hasReceipt: p.has_receipt === 1,
        amount: Number(p.amount),
        currency: p.currency,
        submittedAt: p.created_at.toISOString(),
        orderNumber: p.order_number,
        title: p.title,
        paymentDueAt: p.payment_due_at ? p.payment_due_at.toISOString() : null,
        client: { name: p.client_name, email: p.client_email },
        creator: p.creator_name,
      })),
      payouts: payouts.map((o) => ({
        orderId: o.id,
        orderNumber: o.order_number,
        title: o.title,
        amount: Number(o.amount),
        platformFee: Number(o.platform_fee ?? 0),
        creatorPayout: Number(o.creator_payout ?? 0),
        currency: o.currency,
        completedAt: o.completed_at ? o.completed_at.toISOString() : null,
        creator: { name: o.creator_name, email: o.creator_email },
        payTo: o.pd_method
          ? { method: payoutMethod(o.pd_method)?.label ?? o.pd_method, accountName: o.pd_name, accountNumber: o.pd_number, bankName: o.pd_bank }
          : null,
      })),
      disputes: disputes.map((d) => ({
        orderId: d.id,
        orderNumber: d.order_number,
        title: d.title,
        amount: Number(d.amount),
        currency: d.currency,
        reason: d.reason ?? "",
        reportedAt: d.reported_at ? d.reported_at.toISOString() : null,
        client: { name: d.client_name, email: d.client_email },
        creator: { name: d.creator_name, email: d.creator_email },
      })),
      totals: {
        held: Number(totals?.held ?? 0),
        earnedFees: Number(totals?.earned_fees ?? 0),
      },
    });
  } catch (err) {
    console.error("admin overview failed:", err);
    return NextResponse.json({ error: "Could not load the admin overview." }, { status: 500 });
  }
}
