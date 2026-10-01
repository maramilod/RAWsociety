import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { execute, queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { runOrderSweeps } from "@/lib/order-sweeps";
import { enabledProviders, getProvider } from "@/lib/payments/providers";
import { removeFiles, saveReceipt, UploadError } from "@/lib/uploads";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A bank or wallet transaction number (optional): letters, digits and a few separators
const REFERENCE_RE = /^[A-Za-z0-9][A-Za-z0-9\-_/. ]{3,63}$/;

interface OrderRow extends RowDataPacket {
  id: string;
  order_number: string;
  title: string;
  amount: string;
  currency: string;
  status: string;
  payment_due_at: Date | null;
}

async function loadClientOrder(orderId: string, clientId: string) {
  if (!UUID_RE.test(orderId)) return null;
  return queryOne<OrderRow>(
    `SELECT id, order_number, title, amount, currency, status, payment_due_at
       FROM orders WHERE id = ? AND client_id = ?`,
    [orderId, clientId]
  );
}

async function lastPayment(orderId: string) {
  return queryOne<
    RowDataPacket & {
      status: string;
      method: string;
      provider_ref: string | null;
      failure_reason: string | null;
      sender_name: string | null;
    }
  >(
    `SELECT status, method, provider_ref, failure_reason, sender_name FROM payments
      WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`,
    [orderId]
  );
}

// What the client needs to pay: the amount, the deadline, the ways to pay and how each works
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "client") return NextResponse.json({ error: "Only the client pays for an order." }, { status: 403 });

  const { id } = await params;
  try {
    await runOrderSweeps();
    const order = await loadClientOrder(id, me.id);
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status !== "awaiting_payment") {
      return NextResponse.json({ error: "This order is not waiting for payment." }, { status: 409 });
    }

    const ctx = { orderNumber: order.order_number, amount: Number(order.amount), currency: order.currency };
    const last = await lastPayment(order.id);
    return NextResponse.json({
      order: {
        number: order.order_number,
        title: order.title,
        amount: ctx.amount,
        currency: order.currency,
        paymentDueAt: order.payment_due_at ? order.payment_due_at.toISOString() : null,
      },
      methods: enabledProviders().map((p) => ({
        id: p.id,
        label: p.label,
        description: p.description,
        manual: p.mode === "manual",
        senderBankRequired: p.senderBankRequired,
        instructions: p.instructions(ctx),
      })),
      payment: last
        ? {
            state: last.status === "pending" ? "pending" : last.status === "failed" ? "rejected" : "none",
            method: last.method,
            reference: last.provider_ref,
            senderName: last.sender_name,
            note: last.status === "failed" ? last.failure_reason : null,
          }
        : { state: "none" },
    });
  } catch (err) {
    console.error("payment info failed:", err);
    return NextResponse.json({ error: "Could not load the payment details." }, { status: 500 });
  }
}

// The client says "I paid": who sent it, from which bank, how much, and optionally a receipt photo.
// The admin then finds the transfer in the company account and confirms it.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "client") return NextResponse.json({ error: "Only the client pays for an order." }, { status: 403 });

  const { id } = await params;

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
  const reference = text("reference");
  const paidAmount = Number(text("paidAmount"));
  const receipt = form.get("receipt");

  const provider = getProvider(method);
  if (!provider) return NextResponse.json({ error: "Please choose a payment method." }, { status: 400 });
  if (provider.mode !== "manual") {
    return NextResponse.json({ error: "This payment method is not available yet." }, { status: 400 });
  }
  if (senderName.length < 3 || senderName.length > 120) {
    return NextResponse.json({ error: "Please enter the name of the person who sent the money." }, { status: 400 });
  }
  if (provider.senderBankRequired && (senderBank.length < 2 || senderBank.length > 120)) {
    return NextResponse.json({ error: "Please enter the name of the bank you sent the money from." }, { status: 400 });
  }
  if (senderBank.length > 120) {
    return NextResponse.json({ error: "The bank name is too long." }, { status: 400 });
  }
  if (!Number.isFinite(paidAmount) || paidAmount <= 0 || paidAmount > 10_000_000) {
    return NextResponse.json({ error: "Please enter the amount you sent." }, { status: 400 });
  }
  if (reference && !REFERENCE_RE.test(reference)) {
    return NextResponse.json(
      { error: "The transaction number can only contain letters, digits and - _ / . (4 to 64 characters). You can leave it empty." },
      { status: 400 }
    );
  }

  let receiptId: string | null = null;
  try {
    await runOrderSweeps();
    const order = await loadClientOrder(id, me.id);
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status !== "awaiting_payment") {
      return NextResponse.json({ error: "This order is not waiting for payment. It may have expired." }, { status: 409 });
    }

    const last = await lastPayment(order.id);
    if (last?.status === "pending") {
      return NextResponse.json({ error: "Your payment is already waiting for confirmation." }, { status: 409 });
    }

    if (receipt instanceof File && receipt.size > 0) {
      receiptId = (await saveReceipt(receipt, me.id)).id;
    }

    await execute(
      `INSERT INTO payments
         (id, user_id, order_id, amount, currency, method, status, provider_ref,
          sender_name, sender_bank, paid_amount, receipt_file_id)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [
        randomUUID(), me.id, order.id, order.amount, order.currency, provider.id,
        reference || null, senderName, senderBank || null, Math.round(paidAmount * 100) / 100, receiptId,
      ]
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    // Do not keep a receipt for a payment that was not recorded
    if (receiptId) await removeFiles([receiptId]).catch(() => {});
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    // The same transaction number cannot pay two orders
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "This transaction number was already used. Please check the number on your receipt." },
        { status: 409 }
      );
    }
    console.error("submit payment failed:", err);
    return NextResponse.json({ error: "Could not record your payment." }, { status: 500 });
  }
}
