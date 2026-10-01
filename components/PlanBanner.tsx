"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Membership = {
  current: { code: string; periodEnd: string | null };
  pending: { code: string; name: string } | null;
  plans: { code: string; name: string }[];
};

/** Shows the plan the user is on, and a payment that is waiting for confirmation. */
export default function PlanBanner() {
  const [m, setM] = useState<Membership | null>(null);

  useEffect(() => {
    fetch("/api/membership", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setM)
      .catch(() => {});
  }, []);

  if (!m) return null;
  const name = m.plans.find((p) => p.code === m.current.code)?.name ?? "Free";
  const until = m.current.periodEnd ? new Date(m.current.periodEnd).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <div className="mb-6 flex flex-col gap-2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span>
        Your plan: <strong>{name}</strong>
        {until ? ` (until ${until})` : ""}
        {m.pending && <span className="text-blue-700 dark:text-blue-200"> · {m.pending.name} is waiting for payment confirmation</span>}
      </span>
      <Link href="/dashboard/plan" className="font-semibold text-[#C86C29] hover:underline">
        {m.pending ? "View membership" : "Manage plan"}
      </Link>
    </div>
  );
}
