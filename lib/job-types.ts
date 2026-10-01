// Shared by the server and the pages: the jobs board ("clients post work, creators apply").

import type { FieldValue } from "@/components/hire/fields";
import type { LinkKind } from "@/components/services/types";
import type { ClientInfo } from "@/lib/request-status";

export type JobStatus = "open" | "filled" | "closed" | "expired";
export type ApplicationStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export interface JobBudget {
  type: "fixed" | "range" | "quote";
  amount: number | null;
  amountMax: number | null;
  currency: string;
}

export interface JobLink {
  kind: LinkKind;
  label: string | null;
  url: string;
}

/** What a client sees about a creator who applied. */
export interface ApplicantInfo {
  id: string;
  name: string;
  image: string | null;
  category: string;
  rating: number;
  reviews: number;
  completed: number;
}

export interface ApplicationForClient {
  id: string;
  status: ApplicationStatus;
  price: number;
  days: number;
  message: string;
  links: JobLink[];
  createdAt: string;
  orderNumber: string | null;
  creator: ApplicantInfo;
}

export interface JobRow {
  id: string;
  title: string;
  summary: string;
  brief: string;
  category: { id: number; name: string };
  details: Record<string, FieldValue>;
  links: JobLink[];
  files: { id: string; name: string; size: number }[];
  budget: JobBudget;
  deadline: string | null; // YYYY-MM-DD
  status: JobStatus;
  expiresAt: string;
  createdAt: string;
  applicationsCount: number;
  /** Creator's view: who posted it */
  client: (ClientInfo & { id: string; name: string }) | null;
  /** Creator's view: their own application to this job, if any */
  myApplication: { id: string; status: ApplicationStatus; price: number; days: number } | null;
  /** Client's view: everybody who applied */
  applications: ApplicationForClient[] | null;
}

/** A creator's own application, for the "My applications" list. */
export interface MyApplication {
  id: string;
  status: ApplicationStatus;
  price: number;
  days: number;
  message: string;
  createdAt: string;
  orderNumber: string | null;
  job: { id: string; title: string; status: JobStatus; clientName: string; budget: JobBudget };
}

export function jobStatusLabel(status: JobStatus): { label: string; tone: "waiting" | "done" | "stopped" } {
  switch (status) {
    case "open":
      return { label: "Open", tone: "waiting" };
    case "filled":
      return { label: "Creator chosen", tone: "done" };
    case "closed":
      return { label: "Closed", tone: "stopped" };
    case "expired":
      return { label: "Expired", tone: "stopped" };
  }
}

export function applicationStatusLabel(status: ApplicationStatus): { label: string; tone: "waiting" | "done" | "stopped" } {
  switch (status) {
    case "pending":
      return { label: "Under review", tone: "waiting" };
    case "accepted":
      return { label: "Accepted", tone: "done" };
    case "rejected":
      return { label: "Not chosen", tone: "stopped" };
    case "withdrawn":
      return { label: "Withdrawn", tone: "stopped" };
  }
}

export function budgetLabel(b: JobBudget): string {
  const n = (v: number | null) => (v ?? 0).toLocaleString();
  if (b.type === "fixed") return `${n(b.amount)} ${b.currency}`;
  if (b.type === "range") return `${n(b.amount)} to ${n(b.amountMax)} ${b.currency}`;
  return "Open to offers";
}
