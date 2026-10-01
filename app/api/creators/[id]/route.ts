import { NextResponse } from "next/server";
import { query, queryOne, type RowDataPacket } from "@/lib/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CreatorRow extends RowDataPacket {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  about: string | null;
  location: string | null;
  hourly_rate: string | null;
  currency: string;
  badge: "none" | "pro" | "featured" | "top_rated";
  rating: string;
  reviews: number;
  projects: number;
  followers: number;
  avatar_url: string | null;
  cover_url: string | null;
  cv_url: string | null;
}

interface WorkRow extends RowDataPacket {
  id: string;
  title: string;
  category: string | null;
  price: string | null;
  currency: string;
  likes: number;
  cover_url: string | null;
}

interface ServiceRow extends RowDataPacket {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price: string;
  currency: string;
  delivery_days: number | null;
  tags: string | string[] | null;
  cover_url: string | null;
  rating_avg: string | null;
  reviews_count: number;
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

interface ReviewRow extends RowDataPacket {
  id: string;
  service_title: string;
  client_name: string;
  rating: number;
  comment: string | null;
  created_at: Date;
}

const BADGES: Record<CreatorRow["badge"], string | null> = {
  none: null,
  pro: "Pro",
  featured: "Featured",
  top_rated: "Top Rated",
};

// "Maram Milod" -> "Maram M."  (clients' full names are not shown publicly)
function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Creator not found." }, { status: 404 });
  }

  try {
    const c = await queryOne<CreatorRow>(
      `SELECT p.user_id AS id, u.name, cat.name AS role, p.bio, p.about, p.location,
              p.hourly_rate, p.currency, p.badge,
              p.rating_avg AS rating, p.reviews_count AS reviews,
              p.projects_completed AS projects, p.followers_count AS followers,
              u.image AS avatar_url, cov.url AS cover_url, cv.url AS cv_url
         FROM creator_profiles p
         JOIN users u ON u.id = p.user_id AND u.deleted_at IS NULL AND u.status = 'active'
         JOIN categories cat ON cat.id = p.category_id
         LEFT JOIN files cov ON cov.id = p.cover_file_id
         LEFT JOIN files cv ON cv.id = p.cv_file_id
        WHERE p.user_id = ? AND p.is_public = 1`,
      [id]
    );
    if (!c) return NextResponse.json({ error: "Creator not found." }, { status: 404 });

    const [links, services, works, reviews] = await Promise.all([
      query<RowDataPacket & { url: string }>(
        "SELECT url FROM creator_links WHERE creator_id = ? ORDER BY sort_order, url",
        [id]
      ),
      query<ServiceRow>(
        `SELECT s.id, s.title, s.description, cat.name AS category, s.price, s.currency, s.delivery_days,
                s.tags,
                (SELECT ROUND(AVG(r.rating), 1) FROM reviews r JOIN orders ro ON ro.id = r.order_id WHERE ro.service_id = s.id) AS rating_avg,
                (SELECT COUNT(*) FROM reviews r JOIN orders ro ON ro.id = r.order_id WHERE ro.service_id = s.id) AS reviews_count,
                (SELECT f.url FROM service_images si JOIN files f ON f.id = si.file_id
                  WHERE si.service_id = s.id ORDER BY si.sort_order, si.id LIMIT 1) AS cover_url
           FROM services s
           JOIN categories cat ON cat.id = s.category_id
          WHERE s.creator_id = ? AND s.is_active = 1
          ORDER BY s.created_at DESC`,
        [id]
      ),
      query<WorkRow>(
        `SELECT w.id, w.title, cat.name AS category, w.price, w.currency,
                w.likes_count AS likes, f.url AS cover_url
           FROM portfolio_works w
           LEFT JOIN categories cat ON cat.id = w.category_id
           LEFT JOIN files f ON f.id = w.cover_file_id
          WHERE w.creator_id = ?
          ORDER BY w.is_featured DESC, w.created_at DESC`,
        [id]
      ),
      query<ReviewRow>(
        `SELECT r.id, u.name AS client_name, r.rating, r.comment, r.created_at, o.title AS service_title
           FROM reviews r
           JOIN orders o ON o.id = r.order_id
           JOIN users u ON u.id = r.client_id
          WHERE r.creator_id = ?
          ORDER BY r.created_at DESC
          LIMIT 20`,
        [id]
      ),
    ]);

    return NextResponse.json({
      creator: {
        id: c.id,
        name: c.name,
        role: c.role,
        bio: c.bio ?? "",
        about: c.about ?? c.bio ?? "",
        location: c.location,
        rate: c.hourly_rate !== null ? `${Number(c.hourly_rate)} ${c.currency}` : null,
        badge: BADGES[c.badge],
        rating: Number(c.rating).toFixed(1),
        reviewsCount: c.reviews,
        projects: c.projects,
        followers: c.followers,
        avatarUrl: c.avatar_url,
        coverUrl: c.cover_url,
        cvUrl: c.cv_url,
        links: links.map((l) => l.url),
        services: services.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description ?? "",
          category: s.category,
          price: Number(s.price),
          currency: s.currency,
          deliveryDays: s.delivery_days,
          tags: tagList(s.tags),
          coverUrl: s.cover_url,
          rating: s.rating_avg !== null ? Number(s.rating_avg) : null,
          reviewsCount: Number(s.reviews_count),
        })),
        works: works.map((w) => ({
          id: w.id,
          title: w.title,
          category: w.category,
          price: w.price !== null ? `${Number(w.price)} ${w.currency}` : null,
          likes: w.likes,
          coverUrl: w.cover_url,
        })),
        reviews: reviews.map((r) => ({
          id: r.id,
          client: shortName(r.client_name),
          service: r.service_title,
          rating: r.rating,
          comment: r.comment ?? "",
          date: r.created_at,
        })),
      },
    });
  } catch (err) {
    console.error("creator profile query failed:", err);
    return NextResponse.json({ error: "Could not load this profile." }, { status: 500 });
  }
}
