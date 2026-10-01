// Shared by the server and the dashboards: custom requests ("Hire me") and how their status is named for each side.

import type { FieldValue } from "@/components/hire/fields";
import type { LinkKind } from "@/components/services/types";
import type { Tone, Viewer } from "@/lib/order-status";

export type RequestStatus =
  | "open" // the client asked, the creator has not answered
  | "offered" // the creator sent an offer, the client decides
  | "accepted" // the client accepted: an order was created
  | "declined" // the creator said no
  | "cancelled" // the client withdrew
  | "expired"; // nobody answered in time

export const REQUEST_OPEN_DAYS = 14; // a request waits this long for the creator's answer
export const REQUEST_OFFER_DAYS = 7; // an offer waits this long for the client's answer

export function requestStatusLabel(status: RequestStatus, viewer: Viewer): { label: string; tone: Tone } {
  switch (status) {
    case "open":
      return viewer === "client" ? { label: "Waiting for Creator", tone: "waiting" } : { label: "New Custom Request", tone: "waiting" };
    case "offered":
      return viewer === "client" ? { label: "Offer Received", tone: "review" } : { label: "Offer Sent", tone: "review" };
    case "accepted":
      return { label: "Accepted", tone: "done" };
    case "declined":
      return { label: "Declined", tone: "stopped" };
    case "cancelled":
      return viewer === "client" ? { label: "Cancelled", tone: "stopped" } : { label: "Withdrawn", tone: "stopped" };
    case "expired":
      return { label: "Expired", tone: "stopped" };
  }
}

/** Facts about the client, shown to the creator who has to answer (never the client's budget or notes). */
export interface ClientInfo {
  company: string | null;
  industry: string | null;
  size: string | null;
  logoUrl: string | null;
  joinedAt: string;
  completedOrders: number;
  paidOrders: number;
}

export interface RequestRow {
  id: string;
  title: string;
  summary: string;
  brief: string;
  goals: string;
  language: string;
  category: string;
  baseServiceTitle: string | null;
  details: Record<string, FieldValue>;
  links: { kind: LinkKind; label: string | null; url: string }[];
  files: { id: string; name: string; size: number }[];
  budget: {
    type: "fixed" | "range" | "hourly" | "quote";
    amount: number | null;
    amountMax: number | null;
    hourlyRate: number | null;
    hours: number | null;
    currency: string;
  };
  deadline: string | null; // YYYY-MM-DD
  rush: boolean;
  revisions: number;
  usageRights: string;
  nda: boolean;
  portfolio: boolean;
  sourceFiles: boolean;
  contact: string;
  questions: string;
  status: RequestStatus;
  offer: { price: number; days: number; message: string } | null;
  declineNote: string;
  orderId: string | null;
  orderNumber: string | null;
  expiresAt: string;
  createdAt: string;
  other: { id: string; name: string; image: string | null; subtitle: string | null };
  client: ClientInfo | null; // only for the creator's view
}
