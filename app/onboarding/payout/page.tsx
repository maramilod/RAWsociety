"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PAYOUT_METHODS, payoutMethod } from "@/lib/payout-methods";

const field =
  "w-full h-12 rounded-xl border border-[var(--border-default)] bg-[var(--profile-input-bg)] px-4 text-base outline-none focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[var(--brand-orange)]/20";

// Step 3 of 5 for a new creator: where the money of finished orders should be sent.
// Opened with ?edit=1 (from the dashboard) it is a plain settings page.
function PayoutForm() {
  const router = useRouter();
  const edit = useSearchParams().get("edit") === "1";

  const [method, setMethod] = useState<string>(PAYOUT_METHODS[0].id);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/profile/payout", { cache: "no-store" })
      .then((r) => r.json().catch(() => ({})).then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) return setError(d.error || "Could not load your payout details.");
        if (d.payout) {
          setMethod(d.payout.method);
          setAccountName(d.payout.accountName);
          setAccountNumber(d.payout.accountNumber);
          setBankName(d.payout.bankName ?? "");
        }
      })
      .catch(() => setError("Network error. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  const current = payoutMethod(method) ?? PAYOUT_METHODS[0];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/profile/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, accountName, accountNumber, bankName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || "Could not save your payout details.");
      router.push(edit ? "/dashboard/creator" : "/onboarding/plan?role=creator");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      {!edit && (
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Step 3 of 5</p>
          <div className="my-3 h-2 overflow-hidden rounded-full bg-[var(--ui-soft)]">
            <div className="h-2 w-3/5 rounded-full bg-[var(--brand-orange)] transition-all duration-300" />
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase md:text-4xl">Where should we pay you?</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          When a client approves your work, RAW society sends your earnings to this account. Only you and our team can see it.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-7">
        <fieldset>
          <legend className="mb-3 text-sm font-bold uppercase tracking-wider">Payout method</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {PAYOUT_METHODS.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  method === m.id ? "border-[var(--brand-orange)] bg-[var(--brand-orange)]/10" : "border-[var(--border-default)] hover:border-[var(--brand-orange)]/60"
                }`}
              >
                <input type="radio" name="payoutMethod" checked={method === m.id} onChange={() => setMethod(m.id)} className="mt-1 accent-[var(--brand-orange)]" />
                <span>
                  <span className="block font-semibold">{m.label}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{m.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-5">
          <div>
            <label htmlFor="p-name" className="mb-2 block text-sm font-bold uppercase tracking-wider">
              {current.nameLabel}
            </label>
            <input id="p-name" className={field} value={accountName} onChange={(e) => setAccountName(e.target.value)} disabled={loading} autoComplete="name" />
          </div>

          {current.bank && (
            <div>
              <label htmlFor="p-bank" className="mb-2 block text-sm font-bold uppercase tracking-wider">
                Bank name
              </label>
              <input id="p-bank" className={field} value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Jumhouria Bank" disabled={loading} />
            </div>
          )}

          <div>
            <label htmlFor="p-number" className="mb-2 block text-sm font-bold uppercase tracking-wider">
              {current.numberLabel}
            </label>
            <input
              id="p-number"
              className={field}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={current.numberHint}
              inputMode={current.id === "bank_transfer" ? "text" : "numeric"}
              disabled={loading}
              dir="ltr"
            />
            <p className="mt-2 text-xs text-[var(--text-muted)]">Check it twice. A wrong number sends your money to someone else.</p>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
            {error}{" "}
            {error.startsWith("Please log in") && (
              <a href="/login" className="underline">
                Log in
              </a>
            )}
          </p>
        )}

        <div className="flex items-center justify-between border-t border-[var(--ui-border2)] pt-6">
          <button type="button" onClick={() => router.back()} className="rounded-xl border border-[var(--ui-border2)] px-6 py-3 font-medium transition hover:bg-gray-500/10">
            Back
          </button>
          <button
            type="submit"
            disabled={saving || loading}
            className="h-14 rounded-xl bg-[var(--brand-orange)] px-8 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving..." : edit ? "Save payout details" : "Continue to Plans"}
          </button>
        </div>
      </form>
    </main>
  );
}

export default function PayoutPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <PayoutForm />
    </Suspense>
  );
}
