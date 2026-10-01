"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

type State = {
  role: "creator" | "client";
  current: { code: string };
  onboarding: { pending: { name: string } | null; rejection: { reason: string; logoRemoved: boolean } | null };
};

// Shown after the first paid plan is paid: the dashboard opens only when RAW society confirms the payment
export default function WaitingPage() {
  const router = useRouter();
  const [s, setS] = useState<State | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/membership", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "failed");
      setS(body);
      setError("");
      const { pending, rejection } = body.onboarding;
      if (!pending && !rejection) router.replace(body.role === "client" ? "/dashboard/client" : "/dashboard/creator");
    } catch (e) {
      setError(e instanceof Error && e.message !== "failed" ? e.message : "Could not check your payment. Please refresh the page.");
    }
  }, [router]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 10000);
    return () => {
      clearTimeout(t);
      clearInterval(timer);
    };
  }, [load]);

  const acknowledge = async (to: string) => {
    await fetch("/api/membership/ack", { method: "POST" }).catch(() => {});
    router.push(to);
  };

  const rejection = s?.onboarding.rejection;
  const pending = s?.onboarding.pending;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10 text-center">
      {error && (
        <p role="alert" className="mb-6 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      {!s && !error && <p className="text-sm text-gray-500">Loading...</p>}

      {pending && !rejection && (
        <>
          <span className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" aria-hidden="true" />
          <h1 className="text-2xl font-bold sm:text-3xl">We are checking your payment</h1>
          <p className="mt-3 text-sm text-gray-600">
            Your payment for the <strong>{pending.name}</strong> plan was received. Your dashboard opens as soon as RAW society confirms it, usually within 24 hours.
            This page updates by itself.
          </p>
          <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="mx-auto mt-8 rounded-xl border px-5 py-2.5 text-sm font-medium hover:bg-gray-500/20">
            Log out
          </button>
        </>
      )}

      {rejection && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-left">
          <h1 className="text-xl font-bold text-red-900">Your payment was not confirmed</h1>
          {rejection.reason && <p className="mt-3 text-sm text-red-900">Reason: {rejection.reason}</p>}
          <p className="mt-3 text-sm text-red-900">
            Your account is back on the <strong>Free plan</strong>.
            {rejection.logoRemoved && " The company logo you uploaded was removed, because the Free plan does not include company branding."}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => acknowledge(`/onboarding/plan?role=${s?.role ?? "client"}`)}
              className="min-h-11 flex-1 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-700"
            >
              Choose a plan again
            </button>
            <button
              type="button"
              onClick={() => acknowledge(s?.role === "creator" ? "/dashboard/creator" : "/dashboard/client")}
              className="min-h-11 flex-1 rounded-xl border bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              Continue on the Free plan
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
