import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPool, query, queryOne, type RowDataPacket } from "@/lib/db";
import { saveCv, saveImage, UploadError } from "@/lib/uploads";

interface ProfileRow extends RowDataPacket {
  category_name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  cv_name: string | null;
  cv_url: string | null;
}

async function requireCreator() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  }
  if (session.user.role !== "creator") {
    return { error: NextResponse.json({ error: "Only creator accounts have a creator profile." }, { status: 403 }) };
  }
  return { userId: session.user.id };
}

// Load the saved profile so the form can be pre-filled
export async function GET() {
  const auth = await requireCreator();
  if (auth.error) return auth.error;

  const row = await queryOne<ProfileRow>(
    `SELECT c.name AS category_name, p.bio, u.image AS avatar_url,
            cov.url AS cover_url, cv.original_name AS cv_name, cv.url AS cv_url
       FROM creator_profiles p
       JOIN categories c ON c.id = p.category_id
       JOIN users u ON u.id = p.user_id
       LEFT JOIN files cov ON cov.id = p.cover_file_id
       LEFT JOIN files cv ON cv.id = p.cv_file_id
      WHERE p.user_id = ?`,
    [auth.userId]
  );
  if (!row) return NextResponse.json({ profile: null });

  const links = await query<RowDataPacket & { url: string }>(
    "SELECT url FROM creator_links WHERE creator_id = ? ORDER BY sort_order, url",
    [auth.userId]
  );

  return NextResponse.json({
    profile: {
      category: row.category_name,
      bio: row.bio ?? "",
      avatarUrl: row.avatar_url,
      coverUrl: row.cover_url,
      cvName: row.cv_name,
      cvUrl: row.cv_url,
      portfolioLinks: links.map((l) => l.url),
    },
  });
}

// Save (create or update) the profile. Multipart form so the files can be sent too.
export async function POST(request: Request) {
  const auth = await requireCreator();
  if (auth.error) return auth.error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const categoryName = String(form.get("category") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim().slice(0, 2000);

  try {
    const category = await queryOne<RowDataPacket & { id: number }>(
      "SELECT id FROM categories WHERE name = ? AND is_active = 1",
      [categoryName]
    );
    if (!category) throw new UploadError("Please choose your primary specialty.");

    // Portfolio links: http(s) only, unique, at most 10
    const links: string[] = [];
    for (const raw of form.getAll("links")) {
      const value = String(raw).trim();
      if (!value) continue;
      let ok = false;
      try {
        const u = new URL(value);
        ok = u.protocol === "http:" || u.protocol === "https:";
      } catch {
        ok = false;
      }
      if (!ok || value.length > 500) {
        throw new UploadError(`"${value.slice(0, 40)}" is not a valid link (use https://...).`);
      }
      if (!links.includes(value)) links.push(value);
    }
    if (links.length > 10) throw new UploadError("You can add up to 10 portfolio links.");

    // Files (all optional on re-save)
    let avatarUrl: string | null = null;
    let coverId: string | null = null;
    let cvId: string | null = null;
    const avatar = form.get("avatar");
    const cover = form.get("cover");
    const cv = form.get("cv");
    if (avatar instanceof File && avatar.size > 0) avatarUrl = (await saveImage(avatar, auth.userId, "avatar")).url;
    if (cover instanceof File && cover.size > 0) coverId = (await saveImage(cover, auth.userId, "cover")).id;
    if (cv instanceof File && cv.size > 0) cvId = (await saveCv(cv, auth.userId)).id;

    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO creator_profiles (user_id, category_id, bio, cover_file_id, cv_file_id)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           category_id = VALUES(category_id),
           bio = VALUES(bio),
           cover_file_id = COALESCE(VALUES(cover_file_id), cover_file_id),
           cv_file_id = COALESCE(VALUES(cv_file_id), cv_file_id)`,
        [auth.userId, category.id, bio || null, coverId, cvId]
      );
      if (avatarUrl) {
        await conn.query("UPDATE users SET image = ? WHERE id = ?", [avatarUrl, auth.userId]);
      }
      await conn.query("DELETE FROM creator_links WHERE creator_id = ?", [auth.userId]);
      for (let i = 0; i < links.length; i++) {
        await conn.query(
          "INSERT INTO creator_links (id, creator_id, url, sort_order) VALUES (UUID(), ?, ?, ?)",
          [auth.userId, links[i], i]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("save creator profile failed:", err);
    return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
  }
}
