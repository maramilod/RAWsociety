"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import Messenger from "@/components/Messenger";
import PlanBanner from "@/components/PlanBanner";
import ServicesSection from "@/components/services/ServicesSection";
import ServiceModal from "@/components/services/ServiceModal";
import {
  DEFAULT_LIMITS,
  formatPrice,
  type Category,
  type Service,
  type ServiceLimits,
} from "@/components/services/types";
import OrdersSection from "@/components/orders/OrdersSection";
import RequestsSection from "@/components/requests/RequestsSection";
import { useOrders, type CreatorStats } from "@/components/orders/useOrders";

export default function CreatorDashboardPage() {
  const { data: session } = useSession();
  const userName = session?.user?.name;
  const { orders, stats, loading: ordersLoading, error: ordersError, reload: reloadOrders } =
    useOrders<CreatorStats>();

  // الخدمات التي يقدمها المنشئ (من قاعدة البيانات)
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [defaultCategoryId, setDefaultCategoryId] = useState<number | null>(null);
  const [hasProfile, setHasProfile] = useState(true);
  const [currency, setCurrency] = useState("LYD");
  const [limits, setLimits] = useState<ServiceLimits>(DEFAULT_LIMITS);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState("");
  // null = closed, "new" = creating, Service = editing
  const [serviceModal, setServiceModal] = useState<null | "new" | Service>(null);

  const loadServices = useCallback(async () => {
    try {
      const res = await fetch("/api/services", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setServices(data.services);
      setCategories(data.categories);
      setDefaultCategoryId(data.defaultCategoryId);
      setHasProfile(data.hasProfile);
      setCurrency(data.currency);
      if (data.limits) setLimits(data.limits);
      setServicesError("");
    } catch {
      setServicesError("Could not load your services. Please refresh the page.");
    } finally {
      setServicesLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadServices, 0);
    return () => clearTimeout(timer);
  }, [loadServices]);

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2C221E] px-4 py-5 sm:p-6 md:p-10 overflow-x-hidden">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 md:mb-10">
        <div>
          {userName && (
            <p className="text-lg font-semibold text-[#C86C29] mb-1">Hey, {userName}</p>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Creator Dashboard</h1>
          <p className="text-sm text-[#7D6E65] mt-1">
            Welcome back! Here is an overview of your active projects and total earnings.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2 sm:gap-3 [&>*]:text-center [&>*]:min-h-11 sm:[&>*]:min-h-0 [&>*]:flex [&>*]:items-center [&>*]:justify-center">
          <Link
            href="/onboarding/creator"
            className="px-4 py-2 text-sm font-medium border border-[#D9CFC5] rounded-xl hover:border-[#C86C29] transition bg-white"
          >
            Edit Profile
          </Link>
          <Link
            href="/dashboard/creator/jobs"
            className="px-4 py-2 text-sm font-medium border border-[#D9CFC5] rounded-xl hover:border-[#C86C29] transition bg-white"
          >
            Jobs
          </Link>
          <Link
            href="/dashboard/plan"
            className="px-4 py-2 text-sm font-medium border border-[#D9CFC5] rounded-xl hover:border-[#C86C29] transition bg-white"
          >
            Membership
          </Link>
          <button
            type="button"
            onClick={() => setServiceModal("new")}
            className="col-span-2 sm:col-span-1 order-first sm:order-none px-5 py-2 text-sm font-medium bg-[#C86C29] text-white rounded-xl hover:bg-[#B05B1E] transition shadow-sm"
          >
            + New Service
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="px-4 py-2 text-sm font-medium border border-[#D9CFC5] rounded-xl hover:border-red-400 hover:text-red-600 transition bg-white"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        <PlanBanner />
        {/* Analytics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          <div className="p-4 sm:p-6 rounded-2xl bg-white border border-[#EFE8E1] shadow-sm">
            <p className="text-sm font-medium text-[#7D6E65]">Total Revenue</p>
            <p className="text-2xl sm:text-3xl font-extrabold mt-2 text-[#2C221E]">
              {stats ? formatPrice(stats.revenue, "LYD") : "–"}
            </p>
            <span className="inline-block mt-2 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-md">
              {stats && stats.escrow > 0
                ? `${formatPrice(stats.escrow, "LYD")} held until approval`
                : "After the platform fee"}
            </span>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-white border border-[#EFE8E1] shadow-sm">
            <p className="text-sm font-medium text-[#7D6E65]">Active Orders</p>
            <p className="text-2xl sm:text-3xl font-extrabold mt-2 text-[#2C221E]">{stats?.active ?? "–"}</p>
            <span
              className={`inline-block mt-2 text-xs font-semibold px-2.5 py-1 rounded-md ${
                stats && stats.requests > 0 ? "text-purple-700 bg-purple-50" : "text-orange-600 bg-orange-50"
              }`}
            >
              {stats
                ? `${stats.requests} new ${stats.requests === 1 ? "request" : "requests"}${
                    stats.awaitingPayment > 0 ? ` · ${stats.awaitingPayment} awaiting payment` : ""
                  }`
                : "Loading"}
            </span>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-white border border-[#EFE8E1] shadow-sm">
            <p className="text-sm font-medium text-[#7D6E65]">Completed Projects</p>
            <p className="text-2xl sm:text-3xl font-extrabold mt-2 text-[#2C221E]">{stats?.completed ?? "–"}</p>
            <span className="inline-block mt-2 text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
              All time
            </span>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-white border border-[#EFE8E1] shadow-sm">
            <p className="text-sm font-medium text-[#7D6E65]">Rating</p>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-2xl sm:text-3xl font-extrabold text-[#2C221E]">
                {stats && stats.reviews > 0 ? stats.rating.toFixed(1) : "–"}
              </p>
              <span className="text-amber-500 text-lg">★</span>
            </div>
            <span className="inline-block mt-2 text-xs font-semibold text-[#7D6E65]">
              {stats
                ? stats.reviews > 0
                  ? `Based on ${stats.reviews} ${stats.reviews === 1 ? "review" : "reviews"}`
                  : "No reviews yet"
                : "Loading"}
            </span>
          </div>
        </div>

        {/* Custom requests from "Hire me" (answer with an offer) */}
        <RequestsSection viewer="creator" onOrdersChanged={reloadOrders} />

        {/* Booking requests and orders (new requests first need your answer) */}
        <OrdersSection
          viewer="creator"
          orders={orders}
          loading={ordersLoading}
          error={ordersError}
          onChanged={reloadOrders}
        />

        {/* My Services */}
        <ServicesSection
          services={services}
          loading={servicesLoading}
          loadError={servicesError}
          onNew={() => setServiceModal("new")}
          onEdit={(s) => setServiceModal(s)}
          onChanged={loadServices}
        />
      </div>

      {serviceModal && (
        <ServiceModal
          // remount when switching between "new" and a specific service so the form resets
          key={serviceModal === "new" ? "new" : serviceModal.id}
          initial={serviceModal === "new" ? null : serviceModal}
          categories={categories}
          defaultCategoryId={defaultCategoryId}
          currency={currency}
          hasProfile={hasProfile}
          limits={limits}
          onClose={() => setServiceModal(null)}
          onSaved={() => {
            setServiceModal(null);
            loadServices();
          }}
        />
      )}

      <Messenger />
    </div>
  );
}