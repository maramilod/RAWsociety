import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface SessionUser {
  id: string;
  role: "creator" | "client" | "admin";
}

/** The logged-in user from the session cookie, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return { id: session.user.id, role: session.user.role };
}
