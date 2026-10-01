import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { exploreRouteFor } from "@/lib/subscriptions";
import ExploreLimited from "./ExploreLimited";

// A client with a paid plan does not need the limited page
export default async function FreeExplorePage() {
  if ((await exploreRouteFor(await getSessionUser())) === "/explore") redirect("/explore");
  return <ExploreLimited />;
}
