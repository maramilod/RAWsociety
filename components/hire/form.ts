import {
  MAX_REQUEST_FILES,
  MAX_REQUEST_FILE_BYTES,
  MAX_REQUEST_LINKS,
  fieldsFor,
  type FieldSpec,
  type FieldValue,
} from "./fields";
import type { LinkKind } from "@/components/services/types";

export type PricingType = "fixed" | "range" | "hourly" | "quote";

export interface HireLink {
  key: string;
  kind: LinkKind;
  label: string;
  url: string;
}

/** Everything the client types into the form. (Files are kept apart, they cannot be saved as a draft.) */
export interface HireDraft {
  baseServiceId: string; // "" = fully custom, otherwise one of the creator's services to start from
  title: string;
  summary: string;
  brief: string;
  goals: string;
  language: string;
  details: Record<string, FieldValue>; // the specialty questions, by field key
  links: HireLink[];
  pricingType: PricingType;
  amount: string;
  amountMax: string;
  hourlyRate: string;
  hours: string;
  deadlineType: "date" | "flexible";
  deadline: string;
  rush: boolean;
  revisions: string;
  usageRights: string;
  nda: boolean;
  portfolio: boolean;
  sourceFiles: boolean;
  contact: string;
  questions: string;
  terms: boolean;
}

export const STEPS = ["Project", "Details", "Budget and time", "Extras", "Review"] as const;

export function emptyDraft(): HireDraft {
  return {
    baseServiceId: "",
    title: "",
    summary: "",
    brief: "",
    goals: "",
    language: "Arabic",
    details: {},
    links: [],
    pricingType: "fixed",
    amount: "",
    amountMax: "",
    hourlyRate: "",
    hours: "",
    deadlineType: "flexible",
    deadline: "",
    rush: false,
    revisions: "2",
    usageRights: "Commercial use (my business)",
    nda: false,
    portfolio: true,
    sourceFiles: false,
    contact: "In-site messages only",
    questions: "",
    terms: false,
  };
}

const isUrl = (value: string) => {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const todayISO = () => new Date().toISOString().slice(0, 10);

/** The estimated total when the client pays by the hour. */
export function hourlyTotal(d: HireDraft): number | null {
  const rate = Number(d.hourlyRate);
  const hours = Number(d.hours);
  return rate > 0 && hours > 0 ? Math.round(rate * hours * 100) / 100 : null;
}

/** Is a field of the specialty questions filled in? */
function isFilled(spec: FieldSpec, value: FieldValue | undefined): boolean {
  if (spec.type === "toggle") return true;
  if (Array.isArray(value)) return value.some((v) => v.trim() !== "");
  return typeof value === "string" && value.trim() !== "";
}

/** The message for the first problem of a step, or null when the step is fine. */
export function validateStep(step: number, d: HireDraft, category: string, files: File[]): string | null {
  if (step === 0) {
    if (d.title.trim().length < 5) return "Give your request a title (at least 5 characters).";
    if (d.title.trim().length > 120) return "The title is too long (max 120 characters).";
    if (d.summary.trim().length < 30) return "Describe what you need in a few sentences (at least 30 characters).";
    if (d.summary.trim().length > 1500) return "The short description is too long (max 1500 characters).";
    if (d.brief.length > 5000) return "The detailed brief is too long (max 5000 characters).";
    if (d.links.length > MAX_REQUEST_LINKS) return `You can add up to ${MAX_REQUEST_LINKS} links.`;
    for (const l of d.links) {
      if (l.url.trim() && !isUrl(l.url.trim())) return `"${l.url.trim().slice(0, 40)}" is not a valid link (it must start with https://).`;
    }
    if (files.length > MAX_REQUEST_FILES) return `You can attach up to ${MAX_REQUEST_FILES} files.`;
    for (const f of files) {
      if (f.size > MAX_REQUEST_FILE_BYTES) return `"${f.name}" is larger than 10 MB. Add it as a link instead.`;
    }
  }

  if (step === 1) {
    for (const spec of fieldsFor(category)) {
      if (spec.required && !isFilled(spec, d.details[spec.key])) return `Please answer: ${spec.label}`;
      if (spec.type === "date" && typeof d.details[spec.key] === "string" && d.details[spec.key] !== "") {
        if ((d.details[spec.key] as string) < todayISO()) return `"${spec.label}" cannot be in the past.`;
      }
      if (spec.type === "number" && typeof d.details[spec.key] === "string" && d.details[spec.key] !== "") {
        const n = Number(d.details[spec.key]);
        if (!Number.isFinite(n) || (spec.min !== undefined && n < spec.min) || (spec.max !== undefined && n > spec.max)) {
          return `"${spec.label}" must be between ${spec.min ?? 0} and ${spec.max ?? "a larger number"}.`;
        }
      }
    }
  }

  if (step === 2) {
    if (d.pricingType === "fixed" && !(Number(d.amount) >= 1)) return "Enter the price you offer, at least 1 LYD.";
    if (d.pricingType === "range") {
      if (!(Number(d.amount) >= 1)) return "Enter the lowest price of your range, at least 1 LYD.";
      if (!(Number(d.amountMax) >= Number(d.amount))) return "The highest price must be equal to or more than the lowest.";
    }
    if (d.pricingType === "hourly") {
      if (!(Number(d.hourlyRate) >= 1)) return "Enter the hourly rate you offer, at least 1 LYD.";
      if (!(Number(d.hours) >= 1)) return "Enter the number of hours you expect.";
    }
    if (d.pricingType !== "quote" && Math.max(Number(d.amount), Number(d.amountMax), hourlyTotal(d) ?? 0) > 1_000_000) {
      return "That amount is too high.";
    }
    if (d.deadlineType === "date") {
      if (!d.deadline) return "Choose the date you need the work by, or pick \"Flexible\".";
      if (d.deadline <= todayISO()) return "The deadline must be a future date.";
    }
  }

  if (step === 3) {
    if (d.questions.length > 2000) return "Your questions are too long (max 2000 characters).";
  }

  if (step === 4 && !d.terms) return "Please confirm the terms to send your request.";
  return null;
}

/** The first step that has a problem, for the final check. */
export function firstInvalidStep(d: HireDraft, category: string, files: File[]): { step: number; message: string } | null {
  for (let s = 0; s <= 4; s++) {
    const message = validateStep(s, d, category, files);
    if (message) return { step: s, message };
  }
  return null;
}

// ---------------- summary (the review step, and later the request itself) ----------------

export interface SummaryRow {
  label: string;
  value: string;
}
export interface SummarySection {
  title: string;
  step: number;
  rows: SummaryRow[];
}

const yesNo = (v: boolean) => (v ? "Yes" : "No");

export function budgetText(d: HireDraft): string {
  switch (d.pricingType) {
    case "fixed":
      return `${Number(d.amount).toLocaleString()} LYD (fixed price)`;
    case "range":
      return `${Number(d.amount).toLocaleString()} to ${Number(d.amountMax).toLocaleString()} LYD`;
    case "hourly": {
      const total = hourlyTotal(d);
      return `${Number(d.hourlyRate).toLocaleString()} LYD per hour, about ${Number(d.hours)} hours${total ? ` (around ${total.toLocaleString()} LYD)` : ""}`;
    }
    case "quote":
      return "No price set: the client asks the creator for a quote";
  }
}

export function buildSummary(d: HireDraft, category: string, files: File[], baseServiceTitle: string | null): SummarySection[] {
  const details: SummaryRow[] = [];
  for (const spec of fieldsFor(category)) {
    const v = d.details[spec.key];
    if (spec.type === "toggle") {
      if (v === true) details.push({ label: spec.label, value: "Yes" });
      continue;
    }
    if (!isFilled(spec, v)) continue;
    details.push({ label: spec.label, value: Array.isArray(v) ? v.filter((x) => x.trim()).join(", ") : String(v) });
  }

  const links = d.links.filter((l) => l.url.trim());
  return [
    {
      title: "Project",
      step: 0,
      rows: [
        ...(baseServiceTitle ? [{ label: "Based on the service", value: baseServiceTitle }] : []),
        { label: "Title", value: d.title.trim() },
        { label: "Short description", value: d.summary.trim() },
        ...(d.brief.trim() ? [{ label: "Detailed brief", value: d.brief.trim() }] : []),
        ...(d.goals.trim() ? [{ label: "Goals and audience", value: d.goals.trim() }] : []),
        { label: "Language of the work", value: d.language },
        ...(links.length ? [{ label: "Reference links", value: links.map((l) => l.url.trim()).join("\n") }] : []),
        ...(files.length ? [{ label: "Attached files", value: files.map((f) => f.name).join(", ") }] : []),
      ],
    },
    { title: "Details", step: 1, rows: details.length ? details : [{ label: "Answers", value: "Nothing added" }] },
    {
      title: "Budget and time",
      step: 2,
      rows: [
        { label: "Budget", value: budgetText(d) },
        { label: "Needed by", value: d.deadlineType === "date" ? d.deadline : "Flexible" },
        { label: "Urgent (rush job)", value: yesNo(d.rush) },
        { label: "Revisions expected", value: d.revisions },
      ],
    },
    {
      title: "Extras",
      step: 3,
      rows: [
        { label: "Usage rights", value: d.usageRights },
        { label: "Confidentiality agreement (NDA) needed", value: yesNo(d.nda) },
        { label: "Creator may show the work in their portfolio", value: yesNo(d.portfolio) },
        { label: "Source files needed", value: yesNo(d.sourceFiles) },
        { label: "Contact", value: d.contact },
        ...(d.questions.trim() ? [{ label: "Questions for the creator", value: d.questions.trim() }] : []),
      ],
    },
  ];
}

/** The request as a plain object, ready to be sent to the server in the next step of the work. */
export function buildPayload(creatorId: string, d: HireDraft, category: string) {
  return {
    creatorId,
    category,
    baseServiceId: d.baseServiceId || null,
    title: d.title.trim(),
    summary: d.summary.trim(),
    brief: d.brief.trim(),
    goals: d.goals.trim(),
    language: d.language,
    details: d.details,
    links: d.links
      .filter((l) => l.url.trim())
      .map((l) => ({ kind: l.kind, label: l.label.trim() || null, url: l.url.trim() })),
    budget: {
      type: d.pricingType,
      amount: d.pricingType === "quote" ? null : d.pricingType === "hourly" ? hourlyTotal(d) : Number(d.amount),
      amountMax: d.pricingType === "range" ? Number(d.amountMax) : null,
      hourlyRate: d.pricingType === "hourly" ? Number(d.hourlyRate) : null,
      hours: d.pricingType === "hourly" ? Number(d.hours) : null,
      currency: "LYD",
    },
    timeline: { deadline: d.deadlineType === "date" ? d.deadline : null, rush: d.rush },
    revisions: Number(d.revisions),
    terms: {
      usageRights: d.usageRights,
      nda: d.nda,
      portfolio: d.portfolio,
      sourceFiles: d.sourceFiles,
    },
    contact: d.contact,
    questions: d.questions.trim(),
  };
}
