import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getPool, queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { enabledProviders, getProvider } from "@/lib/payments/providers";
import { removeFiles, saveReceipt, UploadError } from "@/lib/uploads";

// A bank or wallet transaction number (optional): letters, digits and a few separators
const REFERENCE_RE = /^[A-Za-z0-9][A-Za-z0-9\-_/. ]{3,63}$/;
const CODE_RE = /^[a-z0-9_]{3,40}$/;

interface Plan extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  price: string;
  currency: string;
  sort_order: number;
}

/** The plan a user wants to buy, if they are allowed to: their own kind, paid, and not lower than the one they have. */
async function loadBuyablePlan(code: string, userId: string, audience: string): Promise<Plan | "forbidden" | null> {
  if (!CODE_RE.test(code)) return null;
  const plan = await queryOne<Plan>(
    "SELECT id, code, name, price, currency, sort_order FROM plans WHERE code = ? AND audience = ? AND is_active = 1",
    [code, audience]
  );
  if (!plan || Number(plan.price) <= 0) return null;
  const active = await queryOne<RowDataPacket & { sort_order: number }>(
    `SELECT p.sort_order FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ? AND s.status = 'active' AND s.current_period_end > UTC_TIMESTAMP(3)
      ORDER BY p.sort_order DESC LIMIT 1`,
    [userId]
  );
  if (active && plan.sort_order < active.sort_order) return "forbidden"; // no downgrades while a higher plan runs
  return plan;
}

const reference = (userId: string) => `PLAN-${userId.slice(0, 6).toUpperCase()}`;

async function pendingPayment(userId: string) {
  return queryOne<RowDataPacket & { status: string }>(
    `SELECT pa.status FROM payments pa JOIN subscriptions s ON s.id = pa.subscription_id
      WHERE s.user_id = ? AND s.status = 'pending' AND pa.status = 'pending' LIMIT 1`,
    [userId]
  );
}

// What the user needs to pay for a membership: the amount and the ways to pay
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "client" && me.role !== "creator") return NextResponse.json({ error: "Not available for this account." }, { status: 403 });

  const { code } = await params;
  try {
    const plan = await loadBuyablePlan(code, me.id, me.role);
    if (plan === "forbidden") return NextResponse.json({ error: "You already have a higher plan." }, { status: 409 });
    if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 });

    const ctx = { orderNumber: reference(me.id), amount: Number(plan.price), currency: plan.currency };
    const pending = await pendingPayment(me.id);
    return NextResponse.json({
      order: { number: ctx.orderNumber, title: `${plan.name} plan, 30 days`, amount: ctx.amount, currency: plan.currency, paymentDueAt: null },
      methods: enabledProviders().map((p) => ({
        id: p.id,
        label: p.label,
        description: p.description,
        manual: p.mode === "manual",
        senderBankRequired: p.senderBankRequired,
        instructions: p.instructions(ctx),
      })),
      payment: pending ? { state: "pending" } : { state: "none" },
    });
  } catch (err) {
    console.error("membership payment info failed:", err);
    return NextResponse.json({ error: "Could not load the payment details." }, { status: 500 });
  }
}

// The user says "I paid": the admin finds the transfer in the company account and activates the plan
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "client" && me.role !== "creator") return NextResponse.json({ error: "Not available for this account." }, { status: 403 });

  const { code } = await params;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const method = text("method");
  const senderName = text("senderName");
  const senderBank = text("senderBank");
  const ref = text("reference");
  const paidAmount = Number(text("paidAmount"));
  const receipt = form.get("receipt");

  const provider = getProvider(method);
  if (!provider) return NextResponse.json({ error: "Please choose a payment method." }, { status: 400 });
  if (provider.mode !== "manual") return NextResponse.json({ error: "This payment method is not available yet." }, { status: 400 });
  if (senderName.length < 3 || senderName.length > 120) {
    return NextResponse.json({ error: "Please enter the name of the person who sent the money." }, { status: 400 });
  }
  if (provider.senderBankRequired && (senderBank.length < 2 || senderBank.length > 120)) {
    return NextResponse.json({ error: "Please enter the name of the bank you sent the money from." }, { status: 400 });
  }
  if (senderBank.length > 120) return NextResponse.json({ error: "The bank name is too long." }, { status: 400 });
  if (!Number.isFinite(paidAmount) || paidAmount <= 0 || paidAmount > 10_000_000) {
    return NextResponse.json({ error: "Please enter the amount you sent." }, { status: 400 });
  }
  if (ref && !REFERENCE_RE.test(ref)) {
    return NextResponse.json(
      { error: "The transaction number can only contain letters, digits and - _ / . (4 to 64 characters). You can leave it empty." },
      { status: 400 }
    );
  }

  let receiptId: string | null = null;
  const conn = await getPool().getConnection();
  try {
    const plan = await loadBuyablePlan(code, me.id, me.role);
    if (plan === "forbidden") return NextResponse.json({ error: "You already have a higher plan." }, { status: 409 });
    if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    if (await pendingPayment(me.id)) {
      return NextResponse.json({ error: "Your payment is already waiting for confirmation." }, { status: 409 });
    }

    if (receipt instanceof File && receipt.size > 0) receiptId = (await saveReceipt(receipt, me.id)).id;

    await conn.beginTransaction();
    const subId = randomUUID();
    await conn.query("INSERT INTO subscriptions (id, user_id, plan_id, status) VALUES (?, ?, ?, 'pending')", [subId, me.id, plan.id]);
    await conn.query(
      `INSERT INTO payments
         (id, user_id, subscription_id, amount, currency, method, status, provider_ref,
          sender_name, sender_bank, paid_amount, receipt_file_id)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [randomUUID(), me.id, subId, plan.price, plan.currency, provider.id, ref || null, senderName, senderBank || null, Math.round(paidAmount * 100) / 100, receiptId]
    );
    await conn.commit();
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (receiptId) await removeFiles([receiptId]).catch(() => {});
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "This transaction number was already used. Please check the number on your receipt." }, { status: 409 });
    }
    console.error("submit membership payment failed:", err);
    return NextResponse.json({ error: "Could not record your payment." }, { status: 500 });
  } finally {
    conn.release();
  }
}
