import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { onboardingState } from "@/lib/subscriptions";

// The first paid plan chosen at sign-up must be confirmed before the dashboard opens
export default async function ClientDashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await getSessionUser();
  if (me && me.role === "client") {
    const state = await onboardingState(me.id);
    if (state.pending || state.rejection) redirect("/onboarding/waiting");
  }
  return children;
}
