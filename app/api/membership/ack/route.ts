import { NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

// The user has read that the first payment was rejected: stop showing the notice
export async function POST() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  await execute(
    `UPDATE notifications SET read_at = UTC_TIMESTAMP(3)
      WHERE user_id = ? AND type = 'payment' AND read_at IS NULL
        AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.kind')) = 'onboarding_rejected'`,
    [me.id]
  );
  return NextResponse.json({ ok: true });
}
