import { execute, query, type RowDataPacket } from "@/lib/db";
import { parseDeliveryLinks } from "@/lib/deliveries";
import {
  CONTACT_OPTIONS,
  LANGUAGE_OPTIONS,
  MAX_REQUEST_FILES,
  MAX_REQUEST_FILE_BYTES,
  MAX_REQUEST_LINKS,
  REVISION_OPTIONS,
  USAGE_RIGHTS,
  fieldsFor,
  type FieldValue,
} from "@/components/hire/fields";
import type { RequestRow, RequestStatus } from "@/lib/request-status";
import { CLIENT_INFO_COLUMNS, CLIENT_INFO_JOINS, toClientInfo, type ClientInfoRow } from "@/lib/client-info";

export { MAX_REQUEST_FILES, MAX_REQUEST_FILE_BYTES };

export const MAX_OPEN_CUSTOM_REQUESTS = 10; // per client, in all
export const MAX_OPEN_PER_CREATOR = 3; // per client and creator

/** A problem with what the user sent. The message is safe to show. */
export class RequestError extends Error {}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID_RE.test(v);

const MAX_PRICE = 1_000_000;

export interface CleanRequest {
  creatorId: string;
  baseServiceId: string | null;
  title: string;
  summary: string;
  brief: string;
  goals: string;
  language: string;
  details: Record<string, FieldValue>;
  links: { kind: string; label: string | null; url: string }[];
  budget: {
    type: "fixed" | "range" | "hourly" | "quote";
    amount: number | null;
    amountMax: number | null;
    hourlyRate: number | null;
    hours: number | null;
  };
  deadline: string | null;
  rush: boolean;
  revisions: number;
  usageRights: string;
  nda: boolean;
  portfolio: boolean;
  sourceFiles: boolean;
  contact: string;
  questions: string;
}

export const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function text(v: unknown, label: string, min: number, max: number): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length < min) throw new RequestError(min > 0 ? `${label} is too short (at least ${min} characters).` : `${label} is missing.`);
  if (s.length > max) throw new RequestError(`${label} is too long (max ${max} characters).`);
  return s;
}

export function optionalText(v: unknown, label: string, max: number): string {
  if (v === undefined || v === null || v === "") return "";
  return text(v, label, 0, max);
}

export function money(v: unknown, label: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > MAX_PRICE) throw new RequestError(`${label} must be between 1 and ${MAX_PRICE.toLocaleString()}.`);
  return Math.round(n * 100) / 100;
}

export function oneOf(v: unknown, list: string[], label: string): string {
  if (typeof v !== "string" || !list.includes(v)) throw new RequestError(`Invalid answer for "${label}".`);
  return v;
}

/**
 * Checks the answers to the specialty questions against the same list the form draws itself from
 * (the creator's specialty decides which questions exist). Unknown keys are dropped, values are cleaned.
 */
export function cleanDetails(raw: unknown, category: string): Record<string, FieldValue> {
  const input = obj(raw);
  const out: Record<string, FieldValue> = {};
  const today = new Date().toISOString().slice(0, 10);
  for (const spec of fieldsFor(category)) {
    const v = input[spec.key];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (spec.required && spec.type !== "toggle" && empty) throw new RequestError(`Please answer: ${spec.label}`);
    if (empty) continue;

    switch (spec.type) {
      case "select":
        out[spec.key] = oneOf(v, spec.options, spec.label);
        break;
      case "multi": {
        if (!Array.isArray(v)) throw new RequestError(`Invalid answer: ${spec.label}`);
        const picked = v.map(String);
        if (picked.some((x) => !spec.options.includes(x))) throw new RequestError(`Invalid answer: ${spec.label}`);
        out[spec.key] = [...new Set(picked)];
        break;
      }
      case "text":
        out[spec.key] = text(v, spec.label, 1, 300);
        break;
      case "textarea":
        out[spec.key] = text(v, spec.label, 1, 1500);
        break;
      case "number": {
        const n = Number(v);
        if (!Number.isFinite(n) || (spec.min !== undefined && n < spec.min) || (spec.max !== undefined && n > spec.max)) {
          throw new RequestError(`"${spec.label}" must be between ${spec.min ?? 0} and ${spec.max ?? 1_000_000}.`);
        }
        out[spec.key] = String(n);
        break;
      }
      case "date": {
        const d = String(v);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) throw new RequestError(`"${spec.label}" is not a valid date.`);
        if (d < today) throw new RequestError(`"${spec.label}" cannot be in the past.`);
        out[spec.key] = d;
        break;
      }
      case "toggle":
        if (v === true) out[spec.key] = true;
        break;
      case "chips":
      case "list": {
        if (!Array.isArray(v)) throw new RequestError(`Invalid answer: ${spec.label}`);
        const max = spec.max ?? 10;
        const items = v.map((x) => String(x).trim()).filter(Boolean);
        if (items.length > max) throw new RequestError(`"${spec.label}" can have up to ${max} items.`);
        if (items.some((x) => x.length > (spec.type === "chips" ? 40 : 200))) throw new RequestError(`An item of "${spec.label}" is too long.`);
        out[spec.key] = items;
        break;
      }
    }
  }
  return out;
}

/** Reads the request sent by the form. `category` is the creator's specialty, taken from the database (never from the client). */
export function cleanRequest(raw: unknown, category: string): CleanRequest {
  const b = obj(raw);
  const budget = obj(b.budget);
  const timeline = obj(b.timeline);
  const terms = obj(b.terms);

  const type = oneOf(budget.type, ["fixed", "range", "hourly", "quote"], "budget type") as CleanRequest["budget"]["type"];
  let amount: number | null = null;
  let amountMax: number | null = null;
  let hourlyRate: number | null = null;
  let hours: number | null = null;
  if (type === "fixed") amount = money(budget.amount, "The price");
  if (type === "range") {
    amount = money(budget.amount, "The lowest price");
    amountMax = money(budget.amountMax, "The highest price");
    if (amountMax < amount) throw new RequestError("The highest price must be equal to or more than the lowest.");
  }
  if (type === "hourly") {
    hourlyRate = money(budget.hourlyRate, "The hourly rate");
    hours = Number(budget.hours);
    if (!Number.isFinite(hours) || hours < 1 || hours > 5000) throw new RequestError("The expected hours must be between 1 and 5000.");
    amount = money(Math.round(hourlyRate * hours * 100) / 100, "The total");
  }

  let deadline: string | null = null;
  if (timeline.deadline) {
    const d = String(timeline.deadline);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) throw new RequestError("The deadline is not a valid date.");
    if (d <= new Date().toISOString().slice(0, 10)) throw new RequestError("The deadline must be a future date.");
    deadline = d;
  }

  const links = Array.isArray(b.links) ? b.links : [];
  if (links.length > MAX_REQUEST_LINKS) throw new RequestError(`You can add up to ${MAX_REQUEST_LINKS} links.`);

  return {
    creatorId: String(b.creatorId ?? ""),
    baseServiceId: b.baseServiceId ? String(b.baseServiceId) : null,
    title: text(b.title, "The title", 5, 120),
    summary: text(b.summary, "The description", 30, 1500),
    brief: optionalText(b.brief, "The detailed brief", 5000),
    goals: optionalText(b.goals, "The goals", 1500),
    language: oneOf(b.language, LANGUAGE_OPTIONS, "language"),
    details: cleanDetails(b.details, category),
    links: parseDeliveryLinks(JSON.stringify(links)),
    budget: { type, amount, amountMax, hourlyRate, hours },
    deadline,
    rush: timeline.rush === true,
    revisions: Number(oneOf(String(b.revisions), REVISION_OPTIONS, "number of revisions")),
    usageRights: oneOf(terms.usageRights, USAGE_RIGHTS, "usage rights"),
    nda: terms.nda === true,
    portfolio: terms.portfolio === true,
    sourceFiles: terms.sourceFiles === true,
    contact: oneOf(b.contact, CONTACT_OPTIONS, "contact option"),
    questions: optionalText(b.questions, "The questions", 2000),
  };
}

/** Requests nobody answered in time end on their own. Called whenever requests are read. */
export async function expireRequests(): Promise<void> {
  await execute(
    "UPDATE custom_requests SET status = 'expired' WHERE status IN ('open','offered') AND expires_at < UTC_TIMESTAMP(3)"
  );
}

// ---------------------------------------------------------------------------------------------
// Reading

interface DbRequest extends ClientInfoRow {
  id: string;
  title: string;
  summary: string;
  brief: string | null;
  goals: string | null;
  language: string;
  category: string;
  base_service_title: string | null;
  details: unknown;
  links: unknown;
  budget_type: RequestRow["budget"]["type"];
  budget_amount: string | null;
  budget_max: string | null;
  hourly_rate: string | null;
  hours: string | null;
  currency: string;
  deadline: Date | null;
  rush: number;
  revisions: number;
  usage_rights: string;
  nda: number;
  portfolio: number;
  source_files: number;
  contact: string;
  questions: string | null;
  status: RequestStatus;
  offer_price: string | null;
  offer_days: number | null;
  offer_message: string | null;
  decline_note: string | null;
  order_id: string | null;
  order_number: string | null;
  expires_at: Date;
  created_at: Date;
  other_id: string;
  other_name: string;
  other_image: string | null;
  other_sub: string | null;
}

// MariaDB gives JSON columns back as text, MySQL as parsed values
function parseJson<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

const num = (v: string | null) => (v === null ? null : Number(v));

/** The requests of a user, newest first. `viewer` decides whose side of the request is "the other person". */
export async function listRequests(userId: string, viewer: "client" | "creator"): Promise<RequestRow[]> {
  const mine = viewer === "client" ? "r.client_id" : "r.creator_id";
  const rows = await query<DbRequest>(
    viewer === "client"
      ? `SELECT r.*, s.title AS base_service_title, o.order_number,
                u.id AS other_id, u.name AS other_name, u.image AS other_image, cat.name AS other_sub
           FROM custom_requests r
           JOIN users u ON u.id = r.creator_id
           LEFT JOIN creator_profiles cp ON cp.user_id = r.creator_id
           LEFT JOIN categories cat ON cat.id = cp.category_id
           LEFT JOIN services s ON s.id = r.base_service_id
           LEFT JOIN orders o ON o.id = r.order_id
          WHERE ${mine} = ? ORDER BY r.created_at DESC LIMIT 200`
      : `SELECT r.*, s.title AS base_service_title, o.order_number,
                u.id AS other_id, u.name AS other_name, u.image AS other_image, clp.company_name AS other_sub,
                ${CLIENT_INFO_COLUMNS}
           FROM custom_requests r
           JOIN users u ON u.id = r.client_id
           ${CLIENT_INFO_JOINS}
           LEFT JOIN services s ON s.id = r.base_service_id
           LEFT JOIN orders o ON o.id = r.order_id
          WHERE ${mine} = ? ORDER BY r.created_at DESC LIMIT 200`,
    [userId]
  );
  if (rows.length === 0) return [];

  const files = await query<RowDataPacket & { request_id: string; id: string; original_name: string; size_bytes: string }>(
    `SELECT cf.request_id, f.id, f.original_name, f.size_bytes
       FROM custom_request_files cf JOIN files f ON f.id = cf.file_id
      WHERE cf.request_id IN (?) ORDER BY f.created_at`,
    [rows.map((r) => r.id)]
  );

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    brief: r.brief ?? "",
    goals: r.goals ?? "",
    language: r.language,
    category: r.category,
    baseServiceTitle: r.base_service_title,
    details: parseJson<Record<string, FieldValue>>(r.details, {}),
    links: parseJson<RequestRow["links"]>(r.links, []),
    files: files.filter((f) => f.request_id === r.id).map((f) => ({ id: f.id, name: f.original_name, size: Number(f.size_bytes) })),
    budget: {
      type: r.budget_type,
      amount: num(r.budget_amount),
      amountMax: num(r.budget_max),
      hourlyRate: num(r.hourly_rate),
      hours: num(r.hours),
      currency: r.currency,
    },
    deadline: r.deadline ? r.deadline.toISOString().slice(0, 10) : null,
    rush: !!r.rush,
    revisions: r.revisions,
    usageRights: r.usage_rights,
    nda: !!r.nda,
    portfolio: !!r.portfolio,
    sourceFiles: !!r.source_files,
    contact: r.contact,
    questions: r.questions ?? "",
    status: r.status,
    offer: r.offer_price !== null ? { price: Number(r.offer_price), days: r.offer_days ?? 0, message: r.offer_message ?? "" } : null,
    declineNote: r.decline_note ?? "",
    orderId: r.order_id,
    orderNumber: r.order_number,
    expiresAt: r.expires_at.toISOString(),
    createdAt: r.created_at.toISOString(),
    other: { id: r.other_id, name: r.other_name, image: r.other_image, subtitle: r.other_sub },
    client: viewer === "creator" ? toClientInfo(r) : null,
  }));
}
