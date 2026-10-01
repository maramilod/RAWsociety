"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/components/services/types";

type Method = {
  id: string;
  label: string;
  description: string;
  manual: boolean;
  senderBankRequired: boolean;
  instructions: string[];
};

type PaymentInfo = {
  order: { number: string; title: string; amount: number; currency: string; paymentDueAt: string | null };
  methods: Method[];
  payment: {
    state: "none" | "pending" | "rejected";
    method?: string;
    reference?: string | null;
    senderName?: string | null;
    note?: string | null;
  };
};

type Props = {
  orderId?: string;
  /** Another thing to pay for (a membership): the API address that answers like /api/orders/[id]/payment */
  endpoint?: string;
  heading?: string;
  onClose: () => void;
  onSubmitted: () => void;
};

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const RECEIPT_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

/** "2 days 3 hours left" / "5 hours left" / "Expired" */
function timeLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 24) return `${Math.floor(hours / 24)} days ${hours % 24} hours left`;
  if (hours >= 1) return `${hours} hours ${minutes} minutes left`;
  return `${minutes} minutes left`;
}

const inputClass =
  "w-full h-11 rounded-xl border border-[#D9CFC5] bg-white px-3 text-sm outline-none focus:border-[#C86C29] focus:ring-2 focus:ring-[#C86C29]/20";

export default function PaymentModal({ orderId, endpoint, heading, onClose, onSubmitted }: Props) {
  const url = endpoint ?? `/api/orders/${orderId}/payment`;
  const isOrder = !endpoint;
  const [info, setInfo] = useState<PaymentInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [methodId, setMethodId] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderBank, setSenderBank] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLoadError(data.error || "Could not load the payment details.");
          setStatus("error");
          return;
        }
        setInfo(data);
        setMethodId(data.methods[0]?.id ?? "");
        setPaidAmount(String(data.order.amount)); // most people send exactly the amount
        setStatus("ready");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setLoadError("Network error. Please try again.");
        setStatus("error");
      });
    return () => controller.abort();
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  const method = info?.methods.find((m) => m.id === methodId);
  const left = info ? timeLeft(info.order.paymentDueAt) : null;
  const differs = info && paidAmount !== "" && Number(paidAmount) !== info.order.amount;

  const chooseReceipt = (file: File | null) => {
    setError("");
    if (!file) return setReceipt(null);
    if (!RECEIPT_TYPES.includes(file.type)) {
      setError("The receipt must be a photo (PNG, JPG, WebP) or a PDF.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setError("The receipt must be 5 MB or smaller.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setReceipt(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!method) return setError("Please choose a payment method.");
    if (senderName.trim().length < 3) return setError("Please enter the name of the person who sent the money.");
    if (method.senderBankRequired && senderBank.trim().length < 2) {
      return setError("Please enter the name of the bank you sent the money from.");
    }
    if (!(Number(paidAmount) > 0)) return setError("Please enter the amount you sent.");

    const form = new FormData();
    form.set("method", method.id);
    form.set("senderName", senderName);
    form.set("senderBank", senderBank);
    form.set("paidAmount", paidAmount);
    form.set("reference", reference);
    if (receipt) form.set("receipt", receipt);

    setSending(true);
    try {
      const res = await fetch(url, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not record your payment.");
        return;
      }
      onSubmitted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !sending && onClose()} />

      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
        className="relative z-10 w-full max-w-lg max-h-[92dvh] flex flex-col rounded-2xl bg-[#FDFBF7] border border-[#EFE8E1] shadow-2xl text-[#2C221E]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EFE8E1] bg-white rounded-t-2xl shrink-0">
          <h2 id="payment-title" className="text-lg font-bold">
            {heading ?? "Pay for your order"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            aria-label="Close"
            className="text-[#7D6E65] hover:text-[#2C221E] text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {status === "loading" && <p className="text-sm text-[#7D6E65]">Loading...</p>}
          {status === "error" && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {loadError}
            </p>
          )}

          {status === "ready" && info && (
            <>
              <div className="rounded-xl border border-[#EFE8E1] bg-white p-4">
                <p className="text-xs text-[#7D6E65]">{info.order.number}</p>
                <p className="font-semibold">{info.order.title}</p>
                <p className="mt-2 text-2xl font-extrabold text-[#C86C29]">
                  {formatPrice(info.order.amount, info.order.currency)}
                </p>
                {left && (
                  <p className={`mt-1 text-xs font-medium ${left === "Expired" ? "text-red-600" : "text-[#7D6E65]"}`}>
                    Pay within: {left}
                  </p>
                )}
                {isOrder && (
                  <p className="mt-2 text-xs text-[#7D6E65]">
                    Your money is held safely by RAW society. The creator only receives it after you approve the delivered
                    work.
                  </p>
                )}
              </div>

              {info.payment.state === "pending" && (
                <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  We received your payment details
                  {info.payment.senderName ? ` (sent by ${info.payment.senderName})` : ""} and are checking our account.
                  {isOrder ? "The order starts as soon as it is confirmed." : "Your plan starts as soon as it is confirmed."}
                </p>
              )}

              {info.payment.state === "rejected" && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  Your last payment could not be confirmed
                  {info.payment.note ? `: ${info.payment.note.replace(/[.\s]+$/, "")}.` : "."} Please check and send it
                  again.
                </p>
              )}

              {info.payment.state !== "pending" && (
                <>
                  <fieldset>
                    <legend className="text-sm font-semibold mb-2">Payment method</legend>
                    <div className="space-y-2">
                      {info.methods.map((m) => (
                        <label
                          key={m.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                            methodId === m.id ? "border-[#C86C29] bg-[#C86C29]/5" : "border-[#D9CFC5] bg-white"
                          }`}
                        >
                          <input
                            type="radio"
                            name="payment-method"
                            value={m.id}
                            checked={methodId === m.id}
                            onChange={() => setMethodId(m.id)}
                            className="mt-1 accent-[#C86C29]"
                          />
                          <span>
                            <span className="block text-sm font-medium">{m.label}</span>
                            <span className="block text-xs text-[#7D6E65]">{m.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {method && (
                    <div className="rounded-xl border border-[#EFE8E1] bg-white p-4">
                      <p className="text-sm font-semibold mb-2">How to pay with {method.label}</p>
                      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-[#554f49]">
                        {method.instructions.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div className="space-y-4">
                    <p className="text-sm font-semibold">After you paid, tell us about it</p>

                    <div>
                      <label htmlFor="pay-name" className="block mb-1.5 text-sm font-medium">
                        Name of the sender
                      </label>
                      <input
                        id="pay-name"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        maxLength={120}
                        placeholder="The name on your bank account or wallet"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label htmlFor="pay-bank" className="block mb-1.5 text-sm font-medium">
                        Your bank{method?.senderBankRequired ? "" : " (optional)"}
                      </label>
                      <input
                        id="pay-bank"
                        value={senderBank}
                        onChange={(e) => setSenderBank(e.target.value)}
                        maxLength={120}
                        placeholder="e.g. Jumhouria Bank"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label htmlFor="pay-amount" className="block mb-1.5 text-sm font-medium">
                        Amount you sent ({info.order.currency})
                      </label>
                      <input
                        id="pay-amount"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        className={inputClass}
                      />
                      {differs && (
                        <p className="mt-1 text-xs text-amber-700">
                          This is different from the {isOrder ? "order" : "plan"} amount ({formatPrice(info.order.amount, info.order.currency)}).
                          If you sent less, we will ask you to send the rest.
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="pay-receipt" className="block mb-1.5 text-sm font-medium">
                        Photo of the receipt <span className="font-normal text-[#7D6E65]">(recommended)</span>
                      </label>
                      <input
                        ref={fileInput}
                        id="pay-receipt"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        onChange={(e) => chooseReceipt(e.target.files?.[0] ?? null)}
                        className="block w-full text-sm text-[#554f49] file:mr-3 file:rounded-lg file:border file:border-[#D9CFC5] file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#2C221E] hover:file:border-[#C86C29]"
                      />
                      <p className="mt-1 text-xs text-[#7D6E65]">
                        A photo or screenshot of the transfer receipt (PNG, JPG, WebP or PDF, up to 5 MB). Only you and
                        our team can see it.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="pay-ref" className="block mb-1.5 text-sm font-medium">
                        Transaction number <span className="font-normal text-[#7D6E65]">(if the receipt has one)</span>
                      </label>
                      <input
                        id="pay-ref"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        maxLength={64}
                        placeholder="Optional"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </>
              )}

              {error && (
                <p role="alert" className="text-sm font-medium text-red-600">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#EFE8E1] bg-white rounded-b-2xl shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm font-medium border border-[#D9CFC5] rounded-xl hover:border-[#C86C29] transition bg-white"
          >
            {info?.payment.state === "pending" ? "Close" : "Cancel"}
          </button>
          {status === "ready" && info && info.payment.state !== "pending" && (
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2 text-sm font-medium bg-[#C86C29] text-white rounded-xl hover:bg-[#B05B1E] transition shadow-sm disabled:opacity-60"
            >
              {sending ? "Sending..." : "I have paid"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
