"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const RECEIPT_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

type Plan = { code: string; name: string; price: number; currency: string; canBuy: boolean };
type Membership = { role: "creator" | "client"; pending: { name: string } | null; plans: Plan[] };
type Info = { methods: { id: string; label: string; instructions: string[] }[]; payment: { state: string } };

const input = "border rounded-lg p-3 w-full focus:outline-none focus:border-orange-500";

// The plan chosen at sign-up is paid by bank transfer and recorded, so it counts for the account.
function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pick = (searchParams.get("plan") || "").toLowerCase().trim();

  const [member, setMember] = useState<Membership | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [method, setMethod] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderBank, setSenderBank] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const plan = member?.plans.find((p) => p.code === pick || p.code === `${member.role}_${pick}`);

  useEffect(() => {
    fetch("/api/membership", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Could not load your plan.");
        setMember(body);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your plan."));
  }, []);

  const planCode = plan?.code;
  useEffect(() => {
    if (!planCode) return;
    fetch(`/api/membership/${planCode}/payment`, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Could not load the payment details.");
        setInfo(body);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the payment details."));
  }, [planCode]);

  const bank = info?.methods.find((m) => m.id === "bank_transfer");
  // the account lines come first, the general steps start at "Send exactly ..."
  const account = bank ? bank.instructions.slice(0, Math.max(bank.instructions.findIndex((l) => l.startsWith("Send exactly")), 0)) : [];

  const handlePayment = async () => {
    setError("");
    if (!plan) return;
    if (senderName.trim().length < 3) return setError("Please enter the name of the person who sent the money.");
    if (senderBank.trim().length < 2) return setError("Please enter the name of the bank you sent the money from.");
    if (receipt && (receipt.size > MAX_RECEIPT_BYTES || !RECEIPT_TYPES.includes(receipt.type))) {
      return setError("The receipt must be a PNG, JPG, WEBP or PDF file up to 5 MB.");
    }
    const form = new FormData();
    form.append("method", "bank_transfer");
    form.append("senderName", senderName.trim());
    form.append("senderBank", senderBank.trim());
    form.append("paidAmount", String(plan.price));
    if (receipt) form.append("receipt", receipt);

    setIsLoading(true);
    try {
      const res = await fetch(`/api/membership/${plan.code}/payment`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || "Could not record your payment.");
      router.push("/onboarding/waiting");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const price = plan?.price ?? 0;
  const currency = plan?.currency ?? "LYD";

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 sm:p-10">
      <h1 className="text-3xl sm:text-4xl font-bold text-center">Payment</h1>

      {member && !plan && (
        <p className="mt-10 text-center text-sm text-gray-600">
          We could not find that plan.{" "}
          <button type="button" className="font-semibold underline" onClick={() => router.push(`/onboarding/plan?role=${member.role}`)}>
            Choose a plan
          </button>
        </p>
      )}
      {!member && !error && <p className="mt-10 text-center text-sm text-gray-500">Loading...</p>}

      <div className="grid md:grid-cols-3 gap-8 mt-10">
        <div className="md:col-span-2 border rounded-xl p-4 sm:p-6">
          <h2 className="font-bold mb-6">Choose payment method</h2>

          <div className="space-y-4">
            {["Sadad (Almadar)", "Mobicash", "Local bank card"].map((name) => (
              <div key={name} aria-disabled="true" className="flex items-center justify-between rounded-lg border border-gray-600/40 bg-gray-500/10 p-4 text-gray-400 cursor-not-allowed">
                <span className="flex items-center">
                  <input type="radio" disabled />
                  <span className="ml-4 font-medium">{name}</span>
                </span>
                <span className="rounded-full bg-gray-500/30 px-2.5 py-0.5 text-xs font-semibold text-gray-300">Coming soon</span>
              </div>
            ))}
            <label className={`flex items-center border rounded-lg p-4 cursor-pointer ${method === "bank_transfer" ? "border-orange-500 bg-orange-50/20" : ""}`}>
              <input type="radio" name="paymentMethod" checked={method === "bank_transfer"} onChange={() => setMethod("bank_transfer")} />
              <span className="ml-4 font-medium">Bank transfer</span>
            </label>
          </div>

          {method === "bank_transfer" && (
            <div className="mt-8 space-y-4">
              <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-4 text-sm">
                <p className="font-semibold">
                  Transfer {price} {currency} to this account:
                </p>
                {account.length > 1 ? (
                  <ul className="mt-2 space-y-1">
                    {account.slice(1).map((l) => (
                      <li key={l} className="break-words font-medium">
                        {l}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-gray-600">The account details are not set up yet. Please contact support before paying.</p>
                )}
              </div>

              <input className={input} placeholder="Name of the person who sent the money" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
              <input className={input} placeholder="Bank you sent the money from" value={senderBank} onChange={(e) => setSenderBank(e.target.value)} />
              <div>
                <label className="block text-sm font-medium mb-1">
                  Receipt <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <input type="file" accept={RECEIPT_TYPES.join(",")} onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-6 text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="border rounded-xl p-6 h-fit bg-white text-gray-900 shadow-sm">
          <h2 className="font-bold text-lg">Order Summary</h2>

          <div className="flex justify-between mt-6 text-sm">
            <span>{plan ? `${plan.name} Plan` : "Plan"}</span>
            <span className="font-semibold">
              {price} {currency}
            </span>
          </div>

          <div className="flex justify-between mt-2 text-sm">
            <span>Fees</span>
            <span className="font-semibold">0 {currency}</span>
          </div>

          <hr className="my-6" />

          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>
              {price} {currency}
            </span>
          </div>

          {member?.pending && (
            <p role="status" className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              Your payment for the {member.pending.name} plan is being checked.
            </p>
          )}

          <button
            onClick={member?.pending ? () => router.push("/onboarding/waiting") : handlePayment}
            disabled={isLoading || !plan || (!member?.pending && (method !== "bank_transfer" || !plan.canBuy))}
            className="w-full mt-8 bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 rounded-lg transition duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Processing...
              </>
            ) : member?.pending ? (
              "Check payment status"
            ) : (
              "Confirm & Pay"
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading payment summary...</div>}>
      <PaymentContent />
    </Suspense>
  );
}
