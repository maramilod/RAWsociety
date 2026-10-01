import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { exploreRouteFor } from "@/lib/subscriptions";
import ExploreFull from "./ExploreFull";

// Clients on the free plan only get the limited explore page
export default async function ExplorePage() {
  if ((await exploreRouteFor(await getSessionUser())) === "/explore/free") redirect("/explore/free");
  return <ExploreFull />;
}
