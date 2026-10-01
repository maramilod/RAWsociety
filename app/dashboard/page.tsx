import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// /dashboard sends each user to the dashboard for their role
export default async function DashboardIndex() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");
  redirect(session.user.role === "creator" ? "/dashboard/creator" : "/dashboard/client");
}
