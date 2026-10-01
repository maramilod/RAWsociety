"use client";

import { useState } from "react";
import Link from "next/link";
import { statusLabel, TONE_CLASSES, type OrderRow, type OrderStatus, type PayoutStatus, type Viewer } from "@/lib/order-status";
import { formatPrice } from "@/components/services/types";
import { openChat } from "@/components/Messenger";
import { sendOrderAction } from "./useOrders";
import PaymentModal from "./PaymentModal";
import DeliverModal from "./DeliverModal";
import DeliveryModal from "./DeliveryModal";
import ReviewForm from "./ReviewForm";
import ClientCard from "@/components/ClientCard";

type TabKey = "all" | "new" | "pay" | "progress" | "done" | "closed";

const TAB_STATUSES: Record<Exclude<TabKey, "all">, OrderStatus[]> = {
  new: ["pending"],
  pay: ["awaiting_payment"],
  progress: ["in_progress", "in_review"],
  done: ["completed"],
  closed: ["cancelled", "disputed"],
};

function tabsFor(viewer: Viewer): { key: TabKey; label: string }[] {
  return [
    { key: "all", label: "All" },
    { key: "new", label: viewer === "client" ? "Pending Approval" : "New Request" },
    { key: "pay", label: viewer === "client" ? "To Pay" : "Awaiting Payment" },
    { key: "progress", label: "In Progress" },
    { key: "done", label: "Completed" },
    { key: "closed", label: "Closed" },
  ];
}

const PAYOUT_TEXT: Record<Exclude<PayoutStatus, "none">, string> = {
  held: "Held until the client approves",
  released: "Approved, payout on its way",
  paid_out: "Paid out to you",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** The "delivery" cell: what matters about time for this order right now. */
function timeText(o: OrderRow): string {
  switch (o.status) {
    case "pending":
      return "After approval";
    case "awaiting_payment":
      if (o.paymentState === "pending") return "Payment being checked";
      return o.paymentDueAt ? `Pay before ${formatDateTime(o.paymentDueAt)}` : "Waiting for payment";
    case "in_review":
      return "Waiting for approval";
    case "disputed":
      return "With RAW society";
    case "in_progress":
    case "completed":
      return o.dueDate ?? "—";
    default:
      return "—";
  }
}

type Props = {
  viewer: Viewer;
  orders: OrderRow[];
  loading: boolean;
  error: string;
  onChanged: () => void;
};

export default function OrdersSection({ viewer, orders, loading, error, onChanged }: Props) {
  const [tab, setTab] = useState<TabKey>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [delivering, setDelivering] = useState<OrderRow | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [rating, setRating] = useState<OrderRow | null>(null);

  const isClient = viewer === "client";
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const toPayCount = orders.filter((o) => o.status === "awaiting_payment" && o.paymentState !== "pending").length;
  const visible = orders.filter((o) => tab === "all" || TAB_STATUSES[tab].includes(o.status));

  const act = async (order: OrderRow, action: "accept" | "decline" | "cancel") => {
    const question: Partial<Record<typeof action, string>> = {
      decline: `Decline the request from ${order.other.name}?`,
      cancel: `Cancel your request to ${order.other.name}?`,
    };
    const q = question[action];
    if (q && !window.confirm(q)) return;

    setActionError("");
    setBusyId(order.id);
    const problem = await sendOrderAction(order.id, action);
    setBusyId(null);
    if (problem) setActionError(problem);
    onChanged();
  };

  // Clients can open a chat with the creator of an order
  const messageCreator = async (order: OrderRow) => {
    setActionError("");
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: order.other.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setActionError(data.error || "Could not open the chat.");
      openChat(data.id);
    } catch {
      setActionError("Network error. Please try again.");
    }
  };

  const small = "px-3 py-1.5 text-xs font-semibold rounded-lg border transition disabled:opacity-50";

  return (
    <div className="bg-white border border-[#EFE8E1] rounded-2xl p-4 sm:p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#EFE8E1] pb-5 mb-6">
        <h2 className="text-xl font-bold">{isClient ? "Your Orders" : "Orders & Requests"}</h2>

        <div className="flex flex-wrap items-center gap-1 bg-[#F7F4F0] p-1 rounded-xl">
          {tabsFor(viewer).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                tab === t.key ? "bg-white text-[#2C221E] shadow-sm" : "text-[#7D6E65] hover:text-[#2C221E]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!isClient && pendingCount > 0 && (
        <div
          role="status"
          className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900"
        >
          <span>
            You have <strong>{pendingCount}</strong> new booking {pendingCount === 1 ? "request" : "requests"} waiting for
            your answer.
          </span>
          {tab !== "new" && (
            <button
              type="button"
              onClick={() => setTab("new")}
              className="self-start sm:self-auto rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-800 transition"
            >
              Review requests
            </button>
          )}
        </div>
      )}

      {isClient && toPayCount > 0 && (
        <div
          role="status"
          className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <span>
            <strong>{toPayCount}</strong> {toPayCount === 1 ? "order was" : "orders were"} accepted by the creator. Pay to
            start the work.
          </span>
          {tab !== "pay" && (
            <button
              type="button"
              onClick={() => setTab("pay")}
              className="self-start sm:self-auto rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 transition"
            >
              Show orders to pay
            </button>
          )}
        </div>
      )}

      {actionError && (
        <p role="alert" className="mb-4 text-sm font-medium text-red-600">
          {actionError}
        </p>
      )}
      {loading && <p className="text-sm text-[#7D6E65]">Loading your orders...</p>}
      {!loading && error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="text-center py-8">
          {isClient ? (
            <>
              <p className="text-sm text-[#7D6E65] mb-4">
                You haven&apos;t booked anything yet. Find a creator and book one of their services.
              </p>
              <Link
                href="/explore"
                className="inline-block px-5 py-2 text-sm font-medium bg-[#C86C29] text-white rounded-xl hover:bg-[#B05B1E] transition"
              >
                Browse services
              </Link>
            </>
          ) : (
            <p className="text-sm text-[#7D6E65]">
              No orders yet. When a client books one of your services, the request appears here.
            </p>
          )}
        </div>
      )}

      {!loading && orders.length > 0 && visible.length === 0 && (
        <p className="text-sm text-[#7D6E65]">No orders in this list.</p>
      )}

      {visible.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm block md:table">
            <thead className="hidden md:table-header-group bg-[#FDFBF7] text-[#7D6E65] border-b border-[#EFE8E1]">
              <tr>
                <th className="pb-3 pt-3 px-4 font-semibold">Order ID</th>
                <th className="pb-3 pt-3 px-4 font-semibold">{isClient ? "Creator" : "Client"}</th>
                <th className="pb-3 pt-3 px-4 font-semibold">Service</th>
                <th className="pb-3 pt-3 px-4 font-semibold">{isClient ? "Amount" : "Price"}</th>
                <th className="pb-3 pt-3 px-4 font-semibold">Status</th>
                <th className="pb-3 pt-3 px-4 font-semibold">{isClient ? "Delivery / Deadline" : "Deadline"}</th>
                <th className="pb-3 pt-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group space-y-4 md:space-y-0 md:divide-y md:divide-[#EFE8E1]">
              {visible.map((o) => {
                const status = statusLabel(o.status, o.cancelledBy, viewer, o.paymentState);
                const busy = busyId === o.id;
                const paid = o.payoutStatus !== "none";
                return (
                  <tr key={o.id} className="block md:table-row rounded-xl border border-[#EFE8E1] md:border-0 p-3 md:p-0 hover:bg-[#FDFBF7]/50 transition align-top">
                    <td data-label="Order" className="block md:table-cell py-2 md:py-4 px-1 md:px-4 font-medium text-[#2C221E] whitespace-nowrap max-md:before:content-[attr(data-label)] max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:text-[#7D6E65] max-md:before:mb-0.5">{o.number}</td>
                    <td data-label={isClient ? "Creator" : "Client"} className="block md:table-cell py-2 md:py-4 px-1 md:px-4 max-md:before:content-[attr(data-label)] max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:text-[#7D6E65] max-md:before:mb-0.5">
                      <div className="font-medium text-[#2C221E]">{o.other.name}</div>
                      {o.other.subtitle && <div className="text-xs text-[#7D6E65]">{o.other.subtitle}</div>}
                    </td>
                    <td data-label="Service" className="block md:table-cell py-2 md:py-4 px-1 md:px-4 text-[#7D6E65] max-w-xs max-md:before:content-[attr(data-label)] max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:text-[#7D6E65] max-md:before:mb-0.5">
                      <div className="text-[#2C221E] font-medium">{o.title}</div>
                      {o.brief && (
                        <p
                          className={`mt-1 text-xs whitespace-pre-line ${
                            !isClient && o.status === "pending" ? "" : "line-clamp-2"
                          }`}
                        >
                          <span className="font-semibold">{isClient ? "Your note: " : "Client note: "}</span>
                          {o.brief}
                        </p>
                      )}
                      {!isClient && o.client && o.status === "pending" && (
                        <div className="mt-2">
                          <ClientCard name={o.other.name} info={o.client} />
                        </div>
                      )}
                      {o.latestNote &&
                        ((o.status === "in_progress" && o.latestNote.kind === "revision_request") ||
                          o.status === "disputed" ||
                          o.latestNote.kind === "dispute_resolution") && (
                          <p
                            className={`mt-1 text-xs whitespace-pre-line rounded-lg px-2 py-1 ${
                              o.latestNote.kind === "revision_request"
                                ? "bg-blue-50 text-blue-900"
                                : o.latestNote.kind === "dispute"
                                  ? "bg-red-50 text-red-900"
                                  : "bg-amber-50 text-amber-900"
                            }`}
                          >
                            <span className="font-semibold">
                              {o.latestNote.kind === "revision_request"
                                ? "Change requested: "
                                : o.latestNote.kind === "dispute"
                                  ? "Problem reported: "
                                  : "Decision by RAW society: "}
                            </span>
                            {o.latestNote.body}
                          </p>
                        )}
                      {o.review && (
                        <p className="mt-1 text-xs rounded-lg bg-amber-50 px-2 py-1 text-amber-900 whitespace-pre-line">
                          <span className="text-amber-500" aria-label={`${o.review.rating} out of 5 stars`}>
                            {"★".repeat(o.review.rating)}
                            <span className="text-amber-200">{"★".repeat(5 - o.review.rating)}</span>
                          </span>{" "}
                          <span className="font-semibold">{isClient ? "Your review" : "Client review"}</span>
                          {o.review.comment ? `: ${o.review.comment}` : ""}
                        </p>
                      )}
                      <p className="mt-1 text-[11px]">Requested {new Date(o.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td data-label={isClient ? "Amount" : "Price"} className="block md:table-cell py-2 md:py-4 px-1 md:px-4 whitespace-nowrap max-md:before:content-[attr(data-label)] max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:text-[#7D6E65] max-md:before:mb-0.5">
                      <div className="font-semibold">{formatPrice(o.amount, o.currency)}</div>
                      {isClient && paid && <div className="mt-1 text-[11px] text-green-700">Paid</div>}
                      {!isClient && o.creatorPayout !== null && o.payoutStatus !== "none" && (
                        <div className="mt-1 text-[11px] text-[#7D6E65]">
                          You receive {formatPrice(o.creatorPayout, o.currency)}
                          <br />
                          <span className="text-[#C86C29]">{PAYOUT_TEXT[o.payoutStatus]}</span>
                        </div>
                      )}
                    </td>
                    <td data-label="Status" className="block md:table-cell py-2 md:py-4 px-1 md:px-4 max-md:before:content-[attr(data-label)] max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:text-[#7D6E65] max-md:before:mb-0.5">
                      <span
                        className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium ${TONE_CLASSES[status.tone]}`}
                      >
                        {status.label}
                      </span>
                      {o.status === "awaiting_payment" && o.paymentState === "rejected" && (
                        <p className="mt-1 max-w-[12rem] text-[11px] text-red-600">
                          Last payment not confirmed{o.paymentNote ? `: ${o.paymentNote}` : ""}
                        </p>
                      )}
                    </td>
                    <td data-label="Deadline" className="block md:table-cell py-2 md:py-4 px-1 md:px-4 text-[#7D6E65] text-xs max-md:before:content-[attr(data-label)] max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:text-[#7D6E65] max-md:before:mb-0.5">{timeText(o)}</td>
                    <td className="block md:table-cell py-2 md:py-4 px-1 md:px-4">
                      <div className="flex flex-wrap md:justify-end gap-2">
                        {/* creator */}
                        {!isClient && o.status === "pending" && (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => act(o, "accept")}
                              className={`${small} border-green-700 bg-green-700 text-white hover:bg-green-800`}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => act(o, "decline")}
                              className={`${small} border-[#D9CFC5] text-red-600 hover:border-red-400`}
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {!isClient && o.status === "in_progress" && (
                          <button
                            type="button"
                            onClick={() => setDelivering(o)}
                            className={`${small} border-[#C86C29] bg-[#C86C29] text-white hover:bg-[#B05B1E]`}
                          >
                            {o.deliveryCount > 0 ? "Deliver again" : "Deliver work"}
                          </button>
                        )}
                        {!isClient && o.deliveryCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setViewingId(o.id)}
                            className={`${small} border-[#D9CFC5] text-[#C86C29] hover:border-[#C86C29]`}
                          >
                            View delivery
                          </button>
                        )}

                        {/* client */}
                        {isClient && o.status === "pending" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => act(o, "cancel")}
                            className={`${small} border-[#D9CFC5] text-red-600 hover:border-red-400`}
                          >
                            Cancel request
                          </button>
                        )}
                        {isClient && o.status === "awaiting_payment" && (
                          <>
                            <button
                              type="button"
                              onClick={() => setPayingId(o.id)}
                              className={`${small} border-[#C86C29] bg-[#C86C29] text-white hover:bg-[#B05B1E]`}
                            >
                              {o.paymentState === "pending" ? "View payment" : "Pay now"}
                            </button>
                            {o.paymentState !== "pending" && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => act(o, "cancel")}
                                className={`${small} border-[#D9CFC5] text-red-600 hover:border-red-400`}
                              >
                                Cancel
                              </button>
                            )}
                          </>
                        )}
                        {isClient && o.status === "in_review" && (
                          <button
                            type="button"
                            onClick={() => setViewingId(o.id)}
                            className={`${small} border-green-700 bg-green-700 text-white hover:bg-green-800`}
                          >
                            Review delivery
                          </button>
                        )}
                        {isClient && o.status === "completed" && !o.review && (
                          <button
                            type="button"
                            onClick={() => setRating(o)}
                            className={`${small} border-amber-500 bg-amber-500 text-white hover:bg-amber-600`}
                          >
                            Rate
                          </button>
                        )}
                        {isClient && o.status !== "in_review" && o.deliveryCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setViewingId(o.id)}
                            className={`${small} border-[#D9CFC5] text-[#C86C29] hover:border-[#C86C29]`}
                          >
                            View delivery
                          </button>
                        )}
                        {isClient && (
                          <button
                            type="button"
                            onClick={() => messageCreator(o)}
                            className={`${small} border-[#D9CFC5] text-[#C86C29] hover:border-[#C86C29]`}
                          >
                            Message
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRating(null)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Rate the creator"
            className="relative z-10 w-full max-w-md rounded-2xl bg-[#FDFBF7] border border-[#EFE8E1] shadow-2xl p-6 text-[#2C221E]"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">Rate the work</h2>
                <p className="text-xs text-[#7D6E65]">
                  {rating.number} · {rating.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRating(null)}
                aria-label="Close"
                className="text-[#7D6E65] hover:text-[#2C221E] text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <ReviewForm
              orderId={rating.id}
              creatorName={rating.other.name}
              onDone={() => {
                setRating(null);
                onChanged();
              }}
              onSkip={() => setRating(null)}
            />
          </div>
        </div>
      )}

      {delivering && (
        <DeliverModal
          orderId={delivering.id}
          orderNumber={delivering.number}
          title={delivering.title}
          revisionNote={delivering.latestNote?.kind === "revision_request" ? delivering.latestNote.body : null}
          onClose={() => setDelivering(null)}
          onDelivered={() => {
            setDelivering(null);
            onChanged();
          }}
        />
      )}

      {viewingId && (
        <DeliveryModal
          orderId={viewingId}
          viewer={viewer}
          onClose={() => setViewingId(null)}
          onChanged={() => {
            setViewingId(null);
            onChanged();
          }}
        />
      )}

      {payingId && (
        <PaymentModal
          orderId={payingId}
          onClose={() => {
            setPayingId(null);
            onChanged();
          }}
          onSubmitted={() => {
            setPayingId(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
