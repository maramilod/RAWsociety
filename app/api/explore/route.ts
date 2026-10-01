import { NextResponse } from "next/server";
import { query, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { serviceLoad } from "@/lib/service-limits";
import { currentPlanCode } from "@/lib/subscriptions";
import { clientRules } from "@/lib/plan-rules";

// The filter chips on /explore -> category slugs
const GROUPS: Record<string, string[]> = {
  Design: ["graphic-design-branding", "ui-ux-design"],
  Photo: ["photography-videography"],
  Dev: ["software-web-development"],
};

interface CreatorRow extends RowDataPacket {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  rating: string;
  reviews: number;
  avatar_url: string | null;
  cv_url: string | null;
}

interface ServiceRow extends RowDataPacket {
  id: string;
  title: string;
  description: string | null;
  price: string;
  currency: string;
  delivery_days: number | null;
  category: string;
  tags: string | string[] | null;
  cover_url: string | null;
  rating_avg: string | null;
  reviews_count: number;
  creator_id: string;
  creator_name: string;
  creator_image: string | null;
}

// MySQL returns JSON columns parsed, MariaDB returns them as text
function tagList(value: string | string[] | null): string[] {
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

interface WorkRow extends RowDataPacket {
  id: string;
  title: string;
  author: string;
  likes: number;
  cover_url: string | null;
}

export async function GET(request: Request) {
  // a client on the free plan sees a few offers only, and not who made them
  const me = await getSessionUser();
  // visitors without an account only get the small teaser the home page gallery shows
  const limit = !me ? 6 : me.role === "client" ? clientRules(await currentPlanCode(me.id, "client")).visibleOffers : null;

  const { searchParams } = new URL(request.url);
  const group = searchParams.get("category") ?? "All";
  const q = (searchParams.get("q") ?? "").trim().slice(0, 80);

  const where = ["u.deleted_at IS NULL", "u.status = 'active'", "p.is_public = 1"];
  const params: unknown[] = [];

  // a limited client always sees the same newest offers: search and categories cannot reveal others
  const slugs = limit === null ? GROUPS[group] : undefined;
  if (slugs) {
    where.push(`c.slug IN (${slugs.map(() => "?").join(",")})`);
    params.push(...slugs);
  }
  if (q && limit === null) {
    const like = `%${q.replace(/[\\%_]/g, (m) => "\\" + m)}%`;
    where.push("(u.name LIKE ? OR p.bio LIKE ? OR c.name LIKE ?)");
    params.push(like, like, like);
  }

  try {
    const creators = await query<CreatorRow>(
      `SELECT p.user_id AS id, u.name, c.name AS role, p.bio,
              p.rating_avg AS rating, p.reviews_count AS reviews,
              u.image AS avatar_url, cv.url AS cv_url
         FROM creator_profiles p
         JOIN users u ON u.id = p.user_id
         JOIN categories c ON c.id = p.category_id
         LEFT JOIN files cv ON cv.id = p.cv_file_id
        WHERE ${where.join(" AND ")}
        ORDER BY p.rating_avg DESC, p.reviews_count DESC, p.created_at DESC
        LIMIT 24`,
      params
    );

    // Live services of public creators, same filters as the creators list
    const sWhere = ["s.is_active = 1", "u.deleted_at IS NULL", "u.status = 'active'", "p.is_public = 1"];
    const sParams: unknown[] = [];
    if (slugs) {
      sWhere.push(`c.slug IN (${slugs.map(() => "?").join(",")})`);
      sParams.push(...slugs);
    }
    if (q && limit === null) {
      const like = `%${q.replace(/[\\%_]/g, (m) => "\\" + m)}%`;
      sWhere.push(
        "(s.title LIKE ? OR s.description LIKE ? OR u.name LIKE ? OR c.name LIKE ? OR CAST(s.tags AS CHAR) LIKE ?)"
      );
      sParams.push(like, like, like, like, like);
    }
    const services = await query<ServiceRow>(
      `SELECT s.id, s.title, s.description, s.price, s.currency, s.delivery_days,
              c.name AS category, s.tags,
              (SELECT ROUND(AVG(r.rating), 1) FROM reviews r JOIN orders ro ON ro.id = r.order_id WHERE ro.service_id = s.id) AS rating_avg,
              (SELECT COUNT(*) FROM reviews r JOIN orders ro ON ro.id = r.order_id WHERE ro.service_id = s.id) AS reviews_count,
              (SELECT f.url FROM service_images si JOIN files f ON f.id = si.file_id
                WHERE si.service_id = s.id ORDER BY si.sort_order, si.id LIMIT 1) AS cover_url,
              p.user_id AS creator_id, u.name AS creator_name, u.image AS creator_image
         FROM services s
         JOIN creator_profiles p ON p.user_id = s.creator_id
         JOIN users u ON u.id = p.user_id
         JOIN categories c ON c.id = s.category_id
        WHERE ${sWhere.join(" AND ")}
        ORDER BY s.created_at DESC
        LIMIT ${limit ?? 12}`,
      sParams
    );

    const works = await query<WorkRow>(
      `SELECT w.id, w.title, u.name AS author, w.likes_count AS likes, f.url AS cover_url
         FROM portfolio_works w
         JOIN creator_profiles p ON p.user_id = w.creator_id AND p.is_public = 1
         JOIN users u ON u.id = w.creator_id AND u.deleted_at IS NULL AND u.status = 'active'
         LEFT JOIN files f ON f.id = w.cover_file_id
        ORDER BY w.is_featured DESC, w.likes_count DESC, w.created_at DESC
        LIMIT 2`
    );

    const loads = await serviceLoad(services.map((s) => s.id));

    if (limit !== null) {
      return NextResponse.json({
        limited: { offers: limit },
        creators: [],
        works: [],
        services: services.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description ?? "",
          price: Number(s.price),
          currency: s.currency,
          deliveryDays: s.delivery_days,
          category: s.category,
          tags: tagList(s.tags),
          coverUrl: s.cover_url,
          rating: s.rating_avg !== null ? Number(s.rating_avg) : null,
          reviewsCount: Number(s.reviews_count),
          full: loads.get(s.id)?.full ?? false,
          creator: null,
        })),
      });
    }

    return NextResponse.json({
      creators: creators.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        bio: c.bio ?? "",
        rating: Number(c.rating).toFixed(1),
        reviews: c.reviews,
        avatarUrl: c.avatar_url,
        cvUrl: c.cv_url,
      })),
      services: services.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description ?? "",
        price: Number(s.price),
        currency: s.currency,
        deliveryDays: s.delivery_days,
        category: s.category,
        tags: tagList(s.tags),
        coverUrl: s.cover_url,
        rating: s.rating_avg !== null ? Number(s.rating_avg) : null,
        reviewsCount: Number(s.reviews_count),
        full: loads.get(s.id)?.full ?? false,
        creator: { id: s.creator_id, name: s.creator_name, image: s.creator_image },
      })),
      works: works.map((w) => ({
        id: w.id,
        title: w.title,
        author: w.author,
        likes: w.likes,
        coverUrl: w.cover_url,
      })),
    });
  } catch (err) {
    console.error("explore query failed:", err);
    return NextResponse.json({ error: "Could not load creators." }, { status: 500 });
  }
}
