"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import PaymentModal from "@/components/orders/PaymentModal";
import { formatPrice } from "@/components/services/types";

type Plan = {
  code: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  jobs: string;
  isCurrent: boolean;
  canBuy: boolean;
};

type Membership = {
  role: "creator" | "client";
  current: { code: string; periodEnd: string | null };
  pending: { code: string; name: string } | null;
  usage: { limit: number | null; used: number } | null;
  clientUsage: { hireMe: { used: number; limit: number | null }; messages: { used: number; limit: number | null } } | null;
  plans: Plan[];
};

export default function MembershipPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<Membership | null>(null);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState<Plan | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/membership", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "failed");
      setData(body);
      setError("");
    } catch (e) {
      setError(e instanceof Error && e.message !== "failed" ? e.message : "Could not load the plans. Please refresh the page.");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const role = data?.role ?? session?.user?.role;
  const back = role === "client" ? "/dashboard/client" : "/dashboard/creator";
  const periodEnd = data?.current.periodEnd ? new Date(data.current.periodEnd).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <div className="min-h-screen bg-[var(--ui-bg)] text-[var(--ui-text)] p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <Link href={back} className="text-sm font-medium text-[#C86C29] hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Membership</h1>
        <p className="mt-1 text-sm text-[var(--ui-muted)]">
          {role === "client"
            ? "Upgrade to post jobs and receive offers from creators."
            : "Upgrade to see the jobs clients post and apply to them."}
        </p>

        {error && (
          <p role="alert" className="mt-6 text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {!data && !error && <p className="mt-6 text-sm text-[var(--ui-muted)]">Loading...</p>}

        {data?.pending && (
          <p role="status" className="mt-6 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-4 py-3 text-sm text-blue-900 dark:text-blue-200">
            Your payment for the <strong>{data.pending.name}</strong> plan is being checked. It starts as soon as RAW society confirms it,
            usually within 24 hours.
          </p>
        )}

        {data?.clientUsage && (data.clientUsage.hireMe.limit !== 0 || data.clientUsage.messages.limit !== 0) && (
          <p className="mt-6 text-sm text-[var(--ui-text2)]">
            This month: Hire me <strong>{data.clientUsage.hireMe.used}</strong>
            {data.clientUsage.hireMe.limit !== null && ` of ${data.clientUsage.hireMe.limit}`}, messages <strong>{data.clientUsage.messages.used}</strong>
            {data.clientUsage.messages.limit !== null && ` of ${data.clientUsage.messages.limit}`}.
          </p>
        )}

        {data && data.usage && data.usage.limit !== null && data.usage.limit > 0 && (
          <p className="mt-6 text-sm text-[var(--ui-text2)]">
            Job applications this month: <strong>{data.usage.used}</strong> of {data.usage.limit}.
          </p>
        )}

        {data && (
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {data.plans.map((p) => (
              <div
                key={p.code}
                className={`flex flex-col rounded-2xl border bg-[var(--ui-surface)] p-6 shadow-sm ${p.isCurrent ? "border-[#C86C29] ring-2 ring-[#C86C29]/20" : "border-[var(--ui-border)]"}`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">{p.name}</h2>
                  {p.isCurrent && <span className="rounded-full bg-[#C86C29]/10 px-2.5 py-1 text-xs font-semibold text-[#C86C29]">Your plan</span>}
                </div>
                <p className="mt-2 text-2xl font-extrabold text-[#C86C29]">
                  {p.price === 0 ? "Free" : formatPrice(p.price, p.currency)}
                  {p.price > 0 && <span className="text-sm font-medium text-[var(--ui-muted)]"> / month</span>}
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span aria-hidden="true" className="text-[#C86C29]">✓</span>
                      {f}
                    </li>
                  ))}
                  {p.jobs && (
                    <li className="flex gap-2 font-medium">
                      <span aria-hidden="true" className="text-[#C86C29]">✓</span>
                      {p.jobs}
                    </li>
                  )}
                </ul>
                {p.isCurrent && periodEnd && <p className="mt-4 text-xs text-[var(--ui-muted)]">Runs until {periodEnd}</p>}
                {p.canBuy && (
                  <button
                    type="button"
                    disabled={!!data.pending}
                    onClick={() => setPaying(p)}
                    className="mt-4 rounded-xl bg-[#C86C29] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#B05B1E] transition disabled:opacity-50"
                  >
                    {p.isCurrent ? "Renew for 30 days" : `Get ${p.name}`}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-8 text-xs text-[var(--ui-muted)]">
          A plan lasts 30 days from the day we confirm your payment. Upgrading replaces your current plan from that day.
        </p>
      </div>

      {paying && (
        <PaymentModal
          endpoint={`/api/membership/${paying.code}/payment`}
          heading={`Get the ${paying.name} plan`}
          onClose={() => setPaying(null)}
          onSubmitted={() => {
            setPaying(null);
            load();
          }}
        />
      )}
    </div>
  );
}
