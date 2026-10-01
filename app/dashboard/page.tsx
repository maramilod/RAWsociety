import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { clientHasDashboard } from "@/lib/subscriptions";

// /dashboard sends each user to the right place for their role and plan
export default async function DashboardIndex() {
  const me = await getSessionUser();
  if (!me) redirect("/login?callbackUrl=/dashboard");
  if (me.role === "creator") redirect("/dashboard/creator");
  if (me.role === "client") redirect((await clientHasDashboard(me.id)) ? "/dashboard/client" : "/explore/free");
  redirect("/admin");
}
