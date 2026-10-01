import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { exploreRouteFor } from "@/lib/subscriptions";
import ExploreLimited from "./ExploreLimited";

// Signed-in clients on the free plan only. Visitors without an account go to the login page.
export default async function FreeExplorePage() {
  const me = await getSessionUser();
  if (!me) redirect("/login?callbackUrl=/explore/free");
  if ((await exploreRouteFor(me)) === "/explore") redirect("/explore");
  return <ExploreLimited />;
}
