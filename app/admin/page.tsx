"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { formatPrice } from "@/components/services/types";
import DeliveryModal from "@/components/orders/DeliveryModal";

type PendingPayment = {
  id: string;
  methodLabel: string;
  reference: string | null;
  senderName: string | null;
  senderBank: string | null;
  paidAmount: number | null;
  hasReceipt: boolean;
  amount: number;
  currency: string;
  submittedAt: string;
  orderNumber: string;
  title: string;
  paymentDueAt: string | null;
  client: { name: string; email: string };
  creator: string;
};

type Payout = {
  orderId: string;
  orderNumber: string;
  title: string;
  amount: number;
  platformFee: number;
  creatorPayout: number;
  currency: string;
  completedAt: string | null;
  creator: { name: string; email: string };
};

type Dispute = {
  orderId: string;
  orderNumber: string;
  title: string;
  amount: number;
  currency: string;
  reason: string;
  reportedAt: string | null;
  client: { name: string; email: string };
  creator: { name: string; email: string };
};

type Overview = {
  payments: PendingPayment[];
  payouts: Payout[];
  disputes: Dispute[];
  totals: { held: number; earnedFees: number };
};

const POLL_MS = 15000;

const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function AdminPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      setData(await res.json());
      setError("");
    } catch {
      setError("Could not load the admin overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  const call = async (id: string, url: string, body: object, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setActionError("");
    setBusyId(id);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) setActionError(result.error || "Something went wrong.");
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setBusyId(null);
      load();
    }
  };

  const confirmPayment = (p: PendingPayment) =>
    call(
      p.id,
      `/api/admin/payments/${p.id}`,
      { action: "confirm" },
      `Confirm ${formatPrice(p.amount, p.currency)} for ${p.orderNumber}?\n\nOnly confirm after you found the transfer in the RAW society account: ${p.senderName ?? "unknown sender"}${
        p.senderBank ? ` (${p.senderBank})` : ""
      }, ${p.paidAmount !== null ? formatPrice(p.paidAmount, p.currency) : "amount not stated"}.\nThe creator can then start working.`
    );

  const rejectPayment = (p: PendingPayment) => {
    const reason = window.prompt(`Why can't you confirm this payment for ${p.orderNumber}? The client will see this.`);
    if (reason === null) return;
    call(p.id, `/api/admin/payments/${p.id}`, { action: "reject", reason });
  };

  const markPaidOut = (o: Payout) =>
    call(
      o.orderId,
      `/api/admin/payouts/${o.orderId}`,
      {},
      `Mark ${formatPrice(o.creatorPayout, o.currency)} as sent to ${o.creator.name}?\n\nDo this only after you have actually transferred the money.`
    );

  // A decision on a reported problem. The note is shown to both the client and the creator.
  const resolve = (d: Dispute, action: "release" | "refund" | "revision") => {
    const what =
      action === "release"
        ? `release the payment to ${d.creator.name}`
        : action === "refund"
          ? `refund ${formatPrice(d.amount, d.currency)} to ${d.client.name} (you send the money yourself)`
          : `send ${d.orderNumber} back to ${d.creator.name} to fix`;
    const note = window.prompt(`You are about to ${what}.\n\nWrite the reason. Both the client and the creator will read it:`);
    if (note === null) return;
    call(d.orderId, `/api/admin/disputes/${d.orderId}`, { action, note });
  };

  const card = "p-6 rounded-2xl bg-white border border-[#EFE8E1] shadow-sm";
  const btn = "px-3 py-1.5 text-xs font-semibold rounded-lg border transition disabled:opacity-50";
  const th = "pb-3 pt-3 px-4 font-semibold";

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2C221E] p-6 md:p-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
        <div>
          {session?.user?.name && (
            <p className="text-lg font-semibold text-[#C86C29] mb-1">Hey, {session.user.name}</p>
          )}
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-sm text-[#7D6E65] mt-1">Confirm client payments and send creators their earnings.</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="self-start px-4 py-2 text-sm font-medium border border-[#D9CFC5] rounded-xl hover:border-red-400 hover:text-red-600 transition bg-white"
        >
          Log out
        </button>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          <div className={card}>
            <p className="text-sm font-medium text-[#7D6E65]">Payments to confirm</p>
            <p className="text-3xl font-extrabold mt-2">{data?.payments.length ?? "–"}</p>
          </div>
          <div className={`${card} ${data && data.disputes.length > 0 ? "border-red-300" : ""}`}>
            <p className="text-sm font-medium text-[#7D6E65]">Open disputes</p>
            <p className="text-3xl font-extrabold mt-2">{data?.disputes.length ?? "–"}</p>
          </div>
          <div className={card}>
            <p className="text-sm font-medium text-[#7D6E65]">Payouts to send</p>
            <p className="text-3xl font-extrabold mt-2">{data?.payouts.length ?? "–"}</p>
          </div>
          <div className={card}>
            <p className="text-sm font-medium text-[#7D6E65]">Held in escrow</p>
            <p className="text-3xl font-extrabold mt-2">{data ? formatPrice(data.totals.held, "LYD") : "–"}</p>
            <span className="inline-block mt-2 text-xs text-[#7D6E65]">Paid, not yet approved</span>
          </div>
          <div className={card}>
            <p className="text-sm font-medium text-[#7D6E65]">Platform fees earned</p>
            <p className="text-3xl font-extrabold mt-2">{data ? formatPrice(data.totals.earnedFees, "LYD") : "–"}</p>
            <span className="inline-block mt-2 text-xs text-[#7D6E65]">From approved orders</span>
          </div>
        </div>

        {actionError && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {actionError}
          </p>
        )}
        {loading && <p className="text-sm text-[#7D6E65]">Loading...</p>}
        {!loading && error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        {/* Disputes: the client reported a problem with the delivered work */}
        {data && data.disputes.length > 0 && (
          <section className="bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-1">Reported problems</h2>
            <p className="text-sm text-[#7D6E65] mb-5">
              The client says something is wrong with the delivered work. Read both sides, look at the delivery, then
              decide. The money stays held until you do.
            </p>
            <ul className="space-y-4">
              {data.disputes.map((d) => (
                <li key={d.orderId} className="rounded-xl border border-[#EFE8E1] p-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {d.orderNumber} · {d.title}{" "}
                        <span className="font-normal text-[#7D6E65]">({formatPrice(d.amount, d.currency)})</span>
                      </p>
                      <p className="text-xs text-[#7D6E65] mt-1">
                        Client: {d.client.name} ({d.client.email}) · Creator: {d.creator.name} ({d.creator.email}) ·
                        Reported {dateTime(d.reportedAt)}
                      </p>
                      <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900 whitespace-pre-line">
                        <span className="font-semibold">Client says: </span>
                        {d.reason}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewingId(d.orderId)}
                        className={`${btn} border-[#D9CFC5] text-[#C86C29] hover:border-[#C86C29]`}
                      >
                        View delivery
                      </button>
                      <button
                        type="button"
                        disabled={busyId === d.orderId}
                        onClick={() => resolve(d, "release")}
                        className={`${btn} border-green-700 bg-green-700 text-white hover:bg-green-800`}
                      >
                        Pay the creator
                      </button>
                      <button
                        type="button"
                        disabled={busyId === d.orderId}
                        onClick={() => resolve(d, "revision")}
                        className={`${btn} border-[#D9CFC5] hover:border-[#C86C29]`}
                      >
                        Send back to fix
                      </button>
                      <button
                        type="button"
                        disabled={busyId === d.orderId}
                        onClick={() => resolve(d, "refund")}
                        className={`${btn} border-[#D9CFC5] text-red-600 hover:border-red-400`}
                      >
                        Refund the client
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Payments to confirm */}
        <section className="bg-white border border-[#EFE8E1] rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-1">Payments to confirm</h2>
          <p className="text-sm text-[#7D6E65] mb-5">
            Clients report a payment with its transaction number. Check it in your bank or wallet, then confirm.
          </p>
          {data && data.payments.length === 0 && <p className="text-sm text-[#7D6E65]">Nothing waiting. All caught up.</p>}
          {data && data.payments.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FDFBF7] text-[#7D6E65] border-b border-[#EFE8E1]">
                  <tr>
                    <th className={th}>Order</th>
                    <th className={th}>Client</th>
                    <th className={th}>Creator</th>
                    <th className={th}>Amount</th>
                    <th className={th}>Sent by</th>
                    <th className={th}>Amount sent</th>
                    <th className={th}>Transaction no.</th>
                    <th className={th}>Receipt</th>
                    <th className={th}>Submitted</th>
                    <th className={`${th} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE8E1]">
                  {data.payments.map((p) => (
                    <tr key={p.id} className="align-top">
                      <td className="py-4 px-4">
                        <div className="font-medium whitespace-nowrap">{p.orderNumber}</div>
                        <div className="text-xs text-[#7D6E65]">{p.title}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-medium">{p.client.name}</div>
                        <div className="text-xs text-[#7D6E65]">{p.client.email}</div>
                      </td>
                      <td className="py-4 px-4">{p.creator}</td>
                      <td className="py-4 px-4 font-semibold whitespace-nowrap">{formatPrice(p.amount, p.currency)}</td>
                      <td className="py-4 px-4">
                        <div className="font-medium">{p.senderName ?? "—"}</div>
                        <div className="text-xs text-[#7D6E65]">
                          {p.senderBank ? `${p.senderBank} · ` : ""}
                          {p.methodLabel}
                        </div>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        {p.paidAmount === null ? (
                          "—"
                        ) : (
                          <>
                            <span className={p.paidAmount === p.amount ? "font-semibold" : "font-semibold text-red-600"}>
                              {formatPrice(p.paidAmount, p.currency)}
                            </span>
                            {p.paidAmount < p.amount && (
                              <div className="text-[11px] text-red-600">Less than the order</div>
                            )}
                            {p.paidAmount > p.amount && (
                              <div className="text-[11px] text-amber-700">More than the order</div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-4 px-4 font-mono text-xs break-all">{p.reference ?? "—"}</td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        {p.hasReceipt ? (
                          <a
                            href={`/api/payments/${p.id}/receipt`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-[#C86C29] hover:underline"
                          >
                            View receipt
                          </a>
                        ) : (
                          <span className="text-xs text-[#7D6E65]">None</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-xs text-[#7D6E65] whitespace-nowrap">{dateTime(p.submittedAt)}</td>
                      <td className="py-4 px-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => confirmPayment(p)}
                            className={`${btn} border-green-700 bg-green-700 text-white hover:bg-green-800`}
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => rejectPayment(p)}
                            className={`${btn} border-[#D9CFC5] text-red-600 hover:border-red-400`}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Payouts to send */}
        <section className="bg-white border border-[#EFE8E1] rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-1">Payouts to send</h2>
          <p className="text-sm text-[#7D6E65] mb-5">
            The client approved the work. Send the creator their share, then mark it as sent.
          </p>
          {data && data.payouts.length === 0 && <p className="text-sm text-[#7D6E65]">No payouts waiting.</p>}
          {data && data.payouts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FDFBF7] text-[#7D6E65] border-b border-[#EFE8E1]">
                  <tr>
                    <th className={th}>Order</th>
                    <th className={th}>Creator</th>
                    <th className={th}>Order amount</th>
                    <th className={th}>Platform fee</th>
                    <th className={th}>Send to creator</th>
                    <th className={th}>Approved</th>
                    <th className={`${th} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE8E1]">
                  {data.payouts.map((o) => (
                    <tr key={o.orderId} className="align-top">
                      <td className="py-4 px-4">
                        <div className="font-medium whitespace-nowrap">{o.orderNumber}</div>
                        <div className="text-xs text-[#7D6E65]">{o.title}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-medium">{o.creator.name}</div>
                        <div className="text-xs text-[#7D6E65]">{o.creator.email}</div>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">{formatPrice(o.amount, o.currency)}</td>
                      <td className="py-4 px-4 whitespace-nowrap">{formatPrice(o.platformFee, o.currency)}</td>
                      <td className="py-4 px-4 font-semibold whitespace-nowrap">{formatPrice(o.creatorPayout, o.currency)}</td>
                      <td className="py-4 px-4 text-xs text-[#7D6E65] whitespace-nowrap">{dateTime(o.completedAt)}</td>
                      <td className="py-4 px-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={busyId === o.orderId}
                            onClick={() => markPaidOut(o)}
                            className={`${btn} border-[#C86C29] bg-[#C86C29] text-white hover:bg-[#B05B1E]`}
                          >
                            Mark as paid out
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {viewingId && (
        <DeliveryModal orderId={viewingId} viewer="admin" onClose={() => setViewingId(null)} onChanged={() => setViewingId(null)} />
      )}
    </div>
  );
}
