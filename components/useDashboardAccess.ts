"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/** For menus: where should "my account" go? Clients on the free plan have no dashboard, only the limited Explore page. */
export function useDashboardAccess() {
  const { data: session, status } = useSession();
  const [hasDashboard, setHasDashboard] = useState(true);

  useEffect(() => {
    if (status !== "authenticated" || session?.user?.role !== "client") return;
    fetch("/api/membership", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setHasDashboard(d.hasDashboard !== false))
      .catch(() => {});
  }, [status, session?.user?.role]);

  return { loggedIn: status === "authenticated" && !!session?.user, hasDashboard };
}
