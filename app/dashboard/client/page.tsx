"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import Messenger from "@/components/Messenger";
import PlanBanner from "@/components/PlanBanner";
import OrdersSection from "@/components/orders/OrdersSection";
import RequestsSection from "@/components/requests/RequestsSection";
import { useOrders, type ClientStats } from "@/components/orders/useOrders";
import { formatPrice } from "@/components/services/types";

export default function ClientDashboardPage() {
  const { data: session } = useSession();
  const userName = session?.user?.name;
  const { orders, stats, loading, error, reload } = useOrders<ClientStats>();

  const card = "p-4 sm:p-6 rounded-2xl bg-[var(--ui-surface)] border border-[var(--ui-border)] shadow-sm";
  const number = "text-2xl sm:text-3xl font-extrabold mt-2 text-[var(--ui-text)]";

  return (
    <div className="min-h-screen bg-[var(--ui-bg)] text-[var(--ui-text)] px-4 py-5 sm:p-6 md:p-10 overflow-x-hidden">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 md:mb-10">
        <div>
          {userName && (
            <p className="text-lg font-semibold text-[#C86C29] mb-1">Hey, {userName}</p>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Client Dashboard</h1>
          <p className="text-sm text-[var(--ui-muted)] mt-1">
            Manage your hired creators, ongoing orders, and active creative requests.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2 sm:gap-3 [&>*]:text-center [&>*]:min-h-11 sm:[&>*]:min-h-0 [&>*]:flex [&>*]:items-center [&>*]:justify-center">
          <Link
            href="/onboarding/client"
            className="px-4 py-2 text-sm font-medium border border-[var(--ui-input)] rounded-xl hover:border-[#C86C29] transition bg-[var(--ui-surface)]"
          >
            Manage Profile
          </Link>
          <Link
            href="/dashboard/client/jobs"
            className="px-4 py-2 text-sm font-medium border border-[var(--ui-input)] rounded-xl hover:border-[#C86C29] transition bg-[var(--ui-surface)]"
          >
            Jobs
          </Link>
          <Link
            href="/dashboard/plan"
            className="px-4 py-2 text-sm font-medium border border-[var(--ui-input)] rounded-xl hover:border-[#C86C29] transition bg-[var(--ui-surface)]"
          >
            Membership
          </Link>
          <Link
            href="/explore"
            className="col-span-2 sm:col-span-1 order-first sm:order-none px-5 py-2 text-sm font-medium bg-[#C86C29] text-white rounded-xl hover:bg-[#B05B1E] transition shadow-sm"
          >
            Find Creators
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="px-4 py-2 text-sm font-medium border border-[var(--ui-input)] rounded-xl hover:border-red-400 hover:text-red-600 transition bg-[var(--ui-surface)]"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        <PlanBanner />
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          <div className={card}>
            <p className="text-sm font-medium text-[var(--ui-muted)]">Active Orders</p>
            <p className={number}>{stats?.active ?? "–"}</p>
            <span className="inline-block mt-2 text-xs font-semibold text-amber-700 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-md">
              {stats
                ? `${stats.pending} awaiting approval${stats.toPay > 0 ? ` · ${stats.toPay} to pay` : ""}`
                : "Loading"}
            </span>
          </div>

          <div className={card}>
            <p className="text-sm font-medium text-[var(--ui-muted)]">Total Investment</p>
            <p className={number}>{stats ? formatPrice(stats.investment, "LYD") : "–"}</p>
            <span className="inline-block mt-2 text-xs font-semibold text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-500/10 px-2.5 py-1 rounded-md">
              Paid orders
            </span>
          </div>

          <div className={card}>
            <p className="text-sm font-medium text-[var(--ui-muted)]">Hired Creators</p>
            <p className={number}>{stats?.hired ?? "–"}</p>
            <span className="inline-block mt-2 text-xs font-semibold text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-md">
              Working with you
            </span>
          </div>

          <div className={card}>
            <p className="text-sm font-medium text-[var(--ui-muted)]">Saved Creators</p>
            <p className={number}>{stats?.saved ?? "–"}</p>
            <span className="inline-block mt-2 text-xs font-semibold text-[var(--ui-muted)] bg-[var(--ui-soft)] px-2.5 py-1 rounded-md">
              In your bookmarks
            </span>
          </div>
        </div>

        {/* Custom requests sent with "Hire me" (offers to accept) */}
        <RequestsSection viewer="client" onOrdersChanged={reload} />

        {/* Orders */}
        <OrdersSection viewer="client" orders={orders} loading={loading} error={error} onChanged={reload} />
      </div>

      <Messenger />
    </div>
  );
}
