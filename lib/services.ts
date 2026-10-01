import { query, queryOne, type RowDataPacket } from "@/lib/db";

export const CURRENCY = "LYD";
export const MAX_SERVICES_PER_CREATOR = 50;
export const MAX_IMAGES = 6;
export const MAX_LINKS = 8;
export const MAX_TAGS = 10;
export const MAX_DELIVERABLES = 10;

export const LINK_KINDS = [
  "github",
  "demo",
  "website",
  "behance",
  "dribbble",
  "figma",
  "youtube",
  "vimeo",
  "drive",
  "other",
] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export interface ServiceLinkInput {
  kind: LinkKind;
  label: string | null;
  url: string;
}

export interface ServiceInput {
  title: string;
  description: string | null;
  categoryId: number;
  price: number;
  deliveryDays: number | null;
  revisions: number | null;
  requirements: string | null;
  tags: string[];
  deliverables: string[];
  links: ServiceLinkInput[];
  isActive: boolean;
}

export type ParseResult = { data: ServiceInput } | { error: string };

function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Accepts a real array, or a JSON string of one (how multipart forms send lists). */
function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function cleanList(
  value: unknown,
  max: number,
  maxLength: number,
  singular: string,
  plural: string
): string[] | { error: string } {
  const out: string[] = [];
  for (const raw of toArray(value)) {
    const item = String(raw ?? "").trim();
    if (!item) continue;
    if (item.length > maxLength) return { error: `Each ${singular} can be at most ${maxLength} characters.` };
    if (!out.some((x) => x.toLowerCase() === item.toLowerCase())) out.push(item);
  }
  if (out.length > max) return { error: `You can add up to ${max} ${plural}.` };
  return out;
}

/** Validates the fields of a create/edit request. Returns clean values or a message for the user. */
export async function parseServiceInput(body: unknown): Promise<ParseResult> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  const title = String(b.title ?? "").trim();
  if (title.length < 3) return { error: "Please enter a title (at least 3 characters)." };
  if (title.length > 160) return { error: "The title is too long (max 160 characters)." };

  const description = String(b.description ?? "").trim();
  if (description.length > 2000) return { error: "The description is too long (max 2000 characters)." };

  const requirements = String(b.requirements ?? "").trim();
  if (requirements.length > 1000) return { error: "\"What I need from you\" is too long (max 1000 characters)." };

  const price = Number(b.price);
  if (!Number.isFinite(price) || price < 1) return { error: `Please enter a price of at least 1 ${CURRENCY}.` };
  if (price > 1_000_000) return { error: "The price is too high." };

  const optionalInt = (raw: unknown, min: number, max: number, message: string): number | null | { error: string } => {
    if (raw === null || raw === undefined || String(raw).trim() === "") return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) return { error: message };
    return n;
  };

  const deliveryDays = optionalInt(b.deliveryDays, 1, 365, "Delivery time must be a whole number of days between 1 and 365.");
  if (deliveryDays !== null && typeof deliveryDays === "object") return deliveryDays;
  const revisions = optionalInt(b.revisions, 0, 20, "Revisions must be a whole number between 0 and 20.");
  if (revisions !== null && typeof revisions === "object") return revisions;

  const tags = cleanList(b.tags, MAX_TAGS, 30, "tag", "tags");
  if (!Array.isArray(tags)) return tags;
  const deliverables = cleanList(b.deliverables, MAX_DELIVERABLES, 120, "\"What's included\" item", "\"What's included\" items");
  if (!Array.isArray(deliverables)) return deliverables;

  const links: ServiceLinkInput[] = [];
  for (const raw of toArray(b.links)) {
    const l = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const url = String(l.url ?? "").trim();
    if (!url) continue;
    if (url.length > 500 || !isHttpUrl(url)) {
      return { error: `"${url.slice(0, 40)}" is not a valid link (it must start with https://).` };
    }
    const kind = LINK_KINDS.includes(l.kind as LinkKind) ? (l.kind as LinkKind) : "other";
    const label = String(l.label ?? "").trim().slice(0, 60);
    if (!links.some((x) => x.url === url)) links.push({ kind, label: label || null, url });
  }
  if (links.length > MAX_LINKS) return { error: `You can add up to ${MAX_LINKS} links.` };

  const categoryId = Number(b.categoryId);
  const category = Number.isInteger(categoryId)
    ? await queryOne<RowDataPacket>("SELECT id FROM categories WHERE id = ? AND is_active = 1", [categoryId])
    : null;
  if (!category) return { error: "Please choose a category." };

  const active = b.isActive;
  return {
    data: {
      title,
      description: description || null,
      categoryId,
      price: Math.round(price * 100) / 100,
      deliveryDays,
      revisions,
      requirements: requirements || null,
      tags,
      deliverables,
      links,
      isActive: active === undefined ? true : active === true || active === "true" || active === 1 || active === "1",
    },
  };
}

// ---------------------------------------------------------------------
// Reading services back (with images and links) for the API responses
// ---------------------------------------------------------------------

export interface ServiceRow extends RowDataPacket {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  category_id: number;
  category: string;
  price: string;
  currency: string;
  delivery_days: number | null;
  revisions: number | null;
  tags: string | string[] | null;
  deliverables: string | string[] | null;
  requirements: string | null;
  is_active: number;
  created_at: Date;
  rating_avg: string | null;
  reviews_count: number;
}

/** The columns every service query must select, so `hydrateServices` can use the rows. */
export const SERVICE_COLUMNS = `s.id, s.creator_id, s.title, s.description, s.category_id, c.name AS category,
  s.price, s.currency, s.delivery_days, s.revisions, s.tags, s.deliverables, s.requirements,
  s.is_active, s.created_at,
  (SELECT ROUND(AVG(r.rating), 1) FROM reviews r JOIN orders ro ON ro.id = r.order_id WHERE ro.service_id = s.id) AS rating_avg,
  (SELECT COUNT(*) FROM reviews r JOIN orders ro ON ro.id = r.order_id WHERE ro.service_id = s.id) AS reviews_count`;

export interface ServiceImage {
  id: string;
  url: string;
}

export interface ServiceLink {
  id: string;
  kind: LinkKind;
  label: string | null;
  url: string;
}

export interface ServiceJson {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  categoryId: number;
  category: string;
  price: number;
  currency: string;
  deliveryDays: number | null;
  revisions: number | null;
  requirements: string;
  tags: string[];
  deliverables: string[];
  images: ServiceImage[];
  coverUrl: string | null;
  links: ServiceLink[];
  isActive: boolean;
  createdAt: Date;
  rating: number | null; // average of the reviews clients left for orders of this service
  reviewsCount: number;
}

// MySQL returns JSON columns parsed, MariaDB returns them as text
function jsonList(value: string | string[] | null): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* ignore bad JSON */
    }
  }
  return [];
}

/** Turns service rows into API objects, loading all their images and links in two queries. */
export async function hydrateServices(rows: ServiceRow[]): Promise<ServiceJson[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [images, links] = await Promise.all([
    query<RowDataPacket & { service_id: string; id: string; url: string }>(
      `SELECT si.service_id, si.id, f.url
         FROM service_images si JOIN files f ON f.id = si.file_id
        WHERE si.service_id IN (?) ORDER BY si.sort_order, si.id`,
      [ids]
    ),
    query<RowDataPacket & { service_id: string; id: string; kind: LinkKind; label: string | null; url: string }>(
      `SELECT service_id, id, kind, label, url
         FROM service_links WHERE service_id IN (?) ORDER BY sort_order, id`,
      [ids]
    ),
  ]);

  return rows.map((r) => {
    const imgs = images.filter((i) => i.service_id === r.id).map((i) => ({ id: i.id, url: i.url }));
    return {
      id: r.id,
      creatorId: r.creator_id,
      title: r.title,
      description: r.description ?? "",
      categoryId: r.category_id,
      category: r.category,
      price: Number(r.price),
      currency: r.currency,
      deliveryDays: r.delivery_days,
      revisions: r.revisions,
      requirements: r.requirements ?? "",
      tags: jsonList(r.tags),
      deliverables: jsonList(r.deliverables),
      images: imgs,
      coverUrl: imgs[0]?.url ?? null,
      links: links
        .filter((l) => l.service_id === r.id)
        .map((l) => ({ id: l.id, kind: l.kind, label: l.label, url: l.url })),
      isActive: r.is_active === 1,
      createdAt: r.created_at,
      rating: r.rating_avg !== null ? Number(r.rating_avg) : null,
      reviewsCount: Number(r.reviews_count),
    };
  });
}
