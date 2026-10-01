"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clientPlanFeatures, creatorPlanFeatures } from "@/lib/plan-rules";

// خطط صناع المحتوى (Creators): the lines come from lib/plan-rules.ts, the same numbers the server enforces
const creatorPlans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "/mo",
    description: "Great for new creators starting their journey.",
    features: creatorPlanFeatures("creator_free"),
    buttonText: "Start Free",
  },
  {
    id: "pro",
    name: "Pro",
    price: 50,
    period: "LYD/mo",
    description: "For active creators looking to land regular clients.",
    features: creatorPlanFeatures("creator_pro"),
    buttonText: "Get Pro",
  },
  {
    id: "max",
    name: "Max",
    price: 70,
    period: "LYD/mo",
    description: "For top creators who want no limits.",
    features: creatorPlanFeatures("creator_max"),
    buttonText: "Get Max",
  },
];

// خطط العملاء (Clients): the lines come from lib/plan-rules.ts, the same numbers the server enforces
const clientPlans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "/mo",
    description: "Ideal for looking around before you hire.",
    features: clientPlanFeatures("client_free"),
    buttonText: "Start Free",
  },
  {
    id: "pro",
    name: "Business Pro",
    price: 150,
    period: "LYD/mo",
    description: "Best for growing businesses hiring regularly.",
    features: clientPlanFeatures("client_pro"),
    buttonText: "Get Pro",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 350,
    period: "LYD/mo",
    description: "For teams that hire a lot and want creators to come to them.",
    features: clientPlanFeatures("client_enterprise"),
    buttonText: "Get Enterprise",
  },
];

function PlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlRole = searchParams.get("role");

  // تحديد الدور بناءً على الـ URL فقط (الافتراضي creator إذا لم يحدد)
  const role: "creator" | "client" = urlRole === "client" ? "client" : "creator";
  const [selected, setSelected] = useState("pro");

  const activePlans = role === "creator" ? creatorPlans : clientPlans;

  const handleContinue = () => {
    if (role === "client") {
      if (selected === "free") {
        router.push("/explore/free");
      } else {
        // الانتقال لصفحة بيانات العميل والشركة للخطط المدفوعة
        router.push(`/onboarding/client?plan=${selected}`);
      }
    } else {
      if (selected === "free") {
        router.push("/dashboard/creator");
      } else {
        // انتقال الكريتور لصفحة الدفع
        router.push(`/onboarding/payment?plan=${selected}&role=creator`);
      }
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-6 md:p-10 min-h-screen flex flex-col justify-between">
      <div>
        {/* Progress bar */}
        <div className="mb-6">
          <p className="text-xs uppercase font-semibold text-[var(--text-muted)] tracking-wider">
            {role === "creator" ? "Step 4 of 5" : "Step 1 of 3"}
          </p>
          <div className="h-2 bg-[var(--ui-soft)] rounded-full my-3 overflow-hidden">
            <div
              className={`h-2 bg-[var(--brand-orange)] rounded-full transition-all duration-300 ${
                role === "creator" ? "w-4/5" : "w-1/3"
              }`}
            />
          </div>
        </div>

        {/* Static Role Indicator (بدون قابلية للتغيير) */}
        <div className="flex justify-center mb-8">
          <div className="bg-[var(--ui-soft)] px-6 py-2.5 rounded-2xl font-bold text-sm text-[var(--ui-text)] shadow-inner">
            {role === "creator" ? "Creator Account Plan" : "Client Account Plan"}
          </div>
        </div>

        {/* Header */}
        <div className="text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-black uppercase mb-2">
            {role === "creator" ? "Choose your creator plan" : "Choose your client plan"}
          </h1>
          <p className="text-[var(--text-muted)] mb-8">
            {role === "creator"
              ? "Showcase your work and get hired by top clients."
              : "Select a subscription plan that fits your business hiring needs."}
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {activePlans.map((plan) => {
            const isSelected = selected === plan.id;
            return (
              <div
                key={plan.id}
                onClick={() => setSelected(plan.id)}
                className={`relative border-2 rounded-2xl p-6 cursor-pointer transition flex flex-col justify-between ${
                  isSelected
                    ? "border-[var(--brand-orange)] bg-orange-50/20 shadow-xl"
                    : "border-[var(--ui-border2)] hover:border-gray-300"
                }`}
              >
                <div>
                  <h2 className="text-2xl font-bold text-[var(--brand-dark)]">
                    {plan.name}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-1 min-h-[32px]">
                    {plan.description}
                  </p>

                  <p className="text-4xl font-extrabold mt-6">
                    {plan.price}
                    <span className="text-sm font-normal text-[var(--ui-muted)]">
                      {" "}{plan.period}
                    </span>
                  </p>

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="text-sm flex items-center gap-2">
                        <span className="text-[var(--brand-orange)] font-bold">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  className={`w-full mt-8 py-3.5 rounded-xl font-semibold transition ${
                    isSelected
                      ? "bg-[var(--brand-orange)] text-white shadow-md"
                      : "bg-[var(--ui-soft)] text-[var(--ui-text)] hover:bg-[var(--ui-soft)]"
                  }`}
                >
                  {isSelected ? "Selected" : plan.buttonText}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex justify-between items-center mt-12 pt-6 border-t border-[var(--ui-border2)]">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 rounded-xl border border-[var(--ui-border2)] font-medium hover:bg-[var(--ui-soft)] transition"
        >
          Back
        </button>

        <button
          type="button"
          onClick={handleContinue}
          className="bg-[var(--cta-bg)] text-[var(--cta-text)] px-8 py-3.5 rounded-xl font-semibold hover:opacity-90 transition shadow-sm"
        >
          {selected === "free" ? "Continue for Free" : "Continue"}
        </button>
      </div>
    </main>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading plans...</div>}>
      <PlanContent />
    </Suspense>
  );
}