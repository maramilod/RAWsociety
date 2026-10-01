import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/session";

/** For admin-only API routes: the admin user, or a ready error response. */
export async function requireAdmin(): Promise<{ admin: SessionUser } | { error: NextResponse }> {
  const me = await getSessionUser();
  if (!me) return { error: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  if (me.role !== "admin") return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  return { admin: me };
}
