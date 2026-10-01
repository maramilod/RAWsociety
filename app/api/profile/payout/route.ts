import { NextResponse } from "next/server";
import { execute, queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { cleanPayout } from "@/lib/payout-methods";

interface PayoutRow extends RowDataPacket {
  method: string;
  account_name: string;
  account_number: string;
  bank_name: string | null;
}

async function requireCreator() {
  const me = await getSessionUser();
  if (!me) return { error: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  if (me.role !== "creator") return { error: NextResponse.json({ error: "Only creator accounts receive payouts." }, { status: 403 }) };
  return { userId: me.id };
}

// Where this creator wants to be paid (null when they have not said yet)
export async function GET() {
  const auth = await requireCreator();
  if (auth.error) return auth.error;
  const row = await queryOne<PayoutRow>(
    "SELECT method, account_name, account_number, bank_name FROM creator_payout_details WHERE user_id = ?",
    [auth.userId]
  );
  return NextResponse.json({
    payout: row ? { method: row.method, accountName: row.account_name, accountNumber: row.account_number, bankName: row.bank_name ?? "" } : null,
  });
}

// Save (create or replace) the payout details
export async function POST(request: Request) {
  const auth = await requireCreator();
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const clean = cleanPayout({
    method: String(body.method ?? ""),
    accountName: String(body.accountName ?? ""),
    accountNumber: String(body.accountNumber ?? ""),
    bankName: String(body.bankName ?? ""),
  });
  if ("error" in clean) return NextResponse.json({ error: clean.error }, { status: 400 });

  try {
    await execute(
      `INSERT INTO creator_payout_details (user_id, method, account_name, account_number, bank_name)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE method = VALUES(method), account_name = VALUES(account_name),
                               account_number = VALUES(account_number), bank_name = VALUES(bank_name)`,
      [auth.userId, clean.method, clean.accountName, clean.accountNumber, clean.bankName]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("save payout details failed:", err);
    return NextResponse.json({ error: "Could not save your payout details." }, { status: 500 });
  }
}
