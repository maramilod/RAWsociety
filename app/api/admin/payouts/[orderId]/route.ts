import { NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The admin has sent the creator their money (outside the site): mark the order as paid out
export async function POST(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { orderId } = await params;
  if (!UUID_RE.test(orderId)) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  try {
    const result = await execute(
      "UPDATE orders SET payout_status = 'paid_out' WHERE id = ? AND payout_status = 'released'",
      [orderId]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "This payout was already marked as sent." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("mark payout failed:", err);
    return NextResponse.json({ error: "Could not update the payout." }, { status: 500 });
  }
}
