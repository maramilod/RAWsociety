// Shared by the server and the dashboards: how an order's status is named for each side.

import type { ClientInfo } from "@/lib/request-status";

export type OrderStatus =
  | "pending" // the client asked, the creator has not answered
  | "awaiting_payment" // the creator accepted, the client has to pay
  | "in_progress" // paid: the creator is working, the money is held by the platform
  | "in_review" // delivered: the client checks the work
  | "completed" // approved: the money goes to the creator
  | "cancelled"
  | "disputed";

export type Viewer = "client" | "creator";
export type Tone = "waiting" | "active" | "review" | "done" | "stopped" | "alert";
export type CancelledBy = "client" | "creator" | "system" | "admin";

/** The state of the latest payment of an order (only meaningful while it awaits payment). */
export type PaymentState = "none" | "pending" | "rejected";

/** Where the creator's money is: held in escrow, released by the client's approval, or sent to the creator. */
export type PayoutStatus = "none" | "held" | "released" | "paid_out";

export interface StatusLabel {
  label: string;
  tone: Tone;
}

/** The wording and colour group for a status, from the client's or the creator's point of view. */
export function statusLabel(
  status: OrderStatus,
  cancelledBy: CancelledBy | null,
  viewer: Viewer,
  paymentState: PaymentState = "none"
): StatusLabel {
  switch (status) {
    case "pending":
      return viewer === "client"
        ? { label: "Pending Approval", tone: "waiting" }
        : { label: "New Request", tone: "waiting" };
    case "awaiting_payment":
      if (paymentState === "pending") return { label: "Payment Under Review", tone: "review" };
      return viewer === "client"
        ? { label: "Awaiting Payment", tone: "waiting" }
        : { label: "Awaiting Client Payment", tone: "waiting" };
    case "in_progress":
      return { label: "In Progress", tone: "active" };
    case "in_review":
      return viewer === "client"
        ? { label: "Ready for Review", tone: "review" }
        : { label: "Delivered", tone: "review" };
    case "completed":
      return { label: "Completed", tone: "done" };
    case "cancelled":
      if (cancelledBy === "creator") return { label: "Declined", tone: "stopped" };
      if (cancelledBy === "system") return { label: "Expired", tone: "stopped" };
      if (cancelledBy === "admin") return { label: "Refunded", tone: "stopped" };
      return viewer === "client"
        ? { label: "Cancelled", tone: "stopped" }
        : { label: "Withdrawn", tone: "stopped" };
    case "disputed":
      return { label: "Under Dispute", tone: "alert" };
  }
}

export const TONE_CLASSES: Record<Tone, string> = {
  waiting: "bg-purple-100 text-purple-800",
  active: "bg-amber-100 text-amber-800",
  review: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
  stopped: "bg-gray-100 text-gray-700",
  alert: "bg-red-100 text-red-800",
};

/** One row of the dashboards' order tables, as returned by GET /api/orders. */
export interface OrderRow {
  id: string;
  number: string;
  title: string;
  brief: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  cancelledBy: CancelledBy | null;
  dueDate: string | null; // YYYY-MM-DD
  paymentDueAt: string | null; // ISO time: pay before this
  paymentState: PaymentState;
  paymentNote: string | null; // why the last payment was rejected
  payoutStatus: PayoutStatus;
  platformFee: number | null;
  creatorPayout: number | null;
  createdAt: string;
  serviceId: string | null;
  deliveryCount: number; // how many times the creator delivered (one per revision round)
  revisionsLeft: number; // revisions the client can still ask for
  latestNote: { kind: "revision_request" | "dispute" | "dispute_resolution"; body: string } | null;
  review: { rating: number; comment: string } | null; // the client's review of the creator, once given
  other: { id: string; name: string; image: string | null; subtitle: string | null };
  client: ClientInfo | null; // only for the creator's view
}
