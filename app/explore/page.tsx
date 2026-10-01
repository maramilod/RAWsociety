import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { exploreRouteFor } from "@/lib/subscriptions";
import ExploreFull from "./ExploreFull";

// Explore is for signed-in users. A client on the free plan only gets the limited page.
export default async function ExplorePage() {
  const me = await getSessionUser();
  if (!me) redirect("/login?callbackUrl=/explore");
  if ((await exploreRouteFor(me)) === "/explore/free") redirect("/explore/free");
  return <ExploreFull />;
}
