import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { execute, queryOne, type RowDataPacket } from "@/lib/db";
import { saveImage, UploadError } from "@/lib/uploads";

// "All fields" is the default for a client who did not say which industry they work in
const ALL_FIELDS = "All fields";
const INDUSTRIES = [ALL_FIELDS, "Technology", "Marketing & Advertising", "Design & Creative", "E-commerce", "Finance"];
const COMPANY_SIZES = ["1 - 10", "11 - 50", "51 - 200", "200+"];
const BUDGETS = ["Less than 1000 LYD", "1000 - 5000 LYD", "5000+ LYD"];
const SERVICES = ["Design", "Web Development", "Photography", "Writing"];

interface ProfileRow extends RowDataPacket {
  nickname: string | null;
  company_name: string | null;
  industry: string | null;
  company_size: string | null;
  budget_range: string | null;
  services_needed: string | string[] | null;
  project_description: string | null;
  logo_url: string | null;
}

async function requireClient() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  }
  if (session.user.role !== "client") {
    return { error: NextResponse.json({ error: "Only client accounts have a client profile." }, { status: 403 }) };
  }
  return { userId: session.user.id };
}

// Load the saved profile so the form can be pre-filled
export async function GET() {
  const auth = await requireClient();
  if (auth.error) return auth.error;

  const row = await queryOne<ProfileRow>(
    `SELECT p.nickname, p.company_name, p.industry, p.company_size, p.budget_range,
            p.services_needed, p.project_description, f.url AS logo_url
       FROM client_profiles p
       LEFT JOIN files f ON f.id = p.logo_file_id
      WHERE p.user_id = ?`,
    [auth.userId]
  );
  if (!row) return NextResponse.json({ profile: null });

  // MySQL returns JSON columns parsed, MariaDB returns them as text
  let services: string[] = [];
  if (Array.isArray(row.services_needed)) services = row.services_needed;
  else if (typeof row.services_needed === "string") {
    try {
      const parsed = JSON.parse(row.services_needed);
      if (Array.isArray(parsed)) services = parsed;
    } catch {
      /* ignore bad JSON */
    }
  }

  return NextResponse.json({
    profile: {
      nickname: row.nickname ?? "",
      company: row.company_name ?? "",
      industry: row.industry ?? "",
      companySize: row.company_size ?? "",
      budget: row.budget_range ?? "",
      services,
      description: row.project_description ?? "",
      logoUrl: row.logo_url,
    },
  });
}

// Save (create or update) the profile. Multipart form so the logo can be sent too.
export async function POST(request: Request) {
  const auth = await requireClient();
  if (auth.error) return auth.error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = (key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

  // The name of the account is the default nickname
  const account = await queryOne<RowDataPacket & { name: string }>("SELECT name FROM users WHERE id = ?", [auth.userId]);
  const accountName = (account?.name ?? "").slice(0, 60);

  // "Skip": make a profile with the defaults, unless one already exists (then nothing changes)
  const skipped = form.get("skip") === "1";
  if (skipped) {
    try {
      await execute(
        `INSERT INTO client_profiles (user_id, nickname, industry, services_needed)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE user_id = user_id`,
        [auth.userId, accountName || null, ALL_FIELDS, JSON.stringify(SERVICES)]
      );
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("skip client profile failed:", err);
      return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
    }
  }

  const nickname = text("nickname", 60) || accountName;
  const company = text("company", 160);
  const industry = text("industry", 100) || ALL_FIELDS;
  const companySize = text("companySize", 40);
  const budget = text("budget", 60);
  const description = text("description", 2000);

  const pick = (value: string, allowed: string[], label: string) => {
    if (value && !allowed.includes(value)) throw new UploadError(`Invalid ${label}.`);
    return value || null;
  };

  try {
    const industryValue = pick(industry, INDUSTRIES, "industry");
    const sizeValue = pick(companySize, COMPANY_SIZES, "company size");
    const budgetValue = pick(budget, BUDGETS, "budget");
    const services = form
      .getAll("services")
      .map(String)
      .filter((s, i, all) => SERVICES.includes(s) && all.indexOf(s) === i);

    let logoId: string | null = null;
    const logo = form.get("logo");
    if (logo instanceof File && logo.size > 0) {
      logoId = (await saveImage(logo, auth.userId, "logo")).id;
    }

    await execute(
      `INSERT INTO client_profiles
         (user_id, nickname, company_name, industry, company_size, budget_range,
          services_needed, project_description, logo_file_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nickname = VALUES(nickname),
         company_name = VALUES(company_name),
         industry = VALUES(industry),
         company_size = VALUES(company_size),
         budget_range = VALUES(budget_range),
         services_needed = VALUES(services_needed),
         project_description = VALUES(project_description),
         logo_file_id = COALESCE(VALUES(logo_file_id), logo_file_id)`,
      [
        auth.userId,
        nickname || null,
        company || null,
        industryValue,
        sizeValue,
        budgetValue,
        JSON.stringify(services),
        description || null,
        logoId,
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("save client profile failed:", err);
    return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
  }
}
