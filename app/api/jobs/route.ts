import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { execute, query, queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { saveDeliveryFile } from "@/lib/deliveries";
import { UploadError, removeFiles } from "@/lib/uploads";
import { MAX_REQUEST_FILE_BYTES } from "@/lib/custom-requests";
import { RequestError, cleanJob, listClientJobs, listOpenJobs, sweepJobs } from "@/lib/jobs";
import { clientCanPostJobs, creatorJobAccess } from "@/lib/subscriptions";
import { JOB_OPEN_DAYS, MAX_JOB_FILES, MAX_OPEN_JOBS } from "@/lib/plan-rules";

async function categories() {
  return query<RowDataPacket & { id: number; name: string }>(
    "SELECT id, name FROM categories WHERE is_active = 1 ORDER BY sort_order, name"
  );
}

// Creator: the open jobs (when the plan allows it). Client: their own jobs with the applications.
export async function GET(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "client" && me.role !== "creator") {
    return NextResponse.json({ error: "Not available for this account." }, { status: 403 });
  }

  try {
    await sweepJobs();
    const cats = await categories();

    if (me.role === "client") {
      const [jobs, post] = await Promise.all([listClientJobs(me.id), clientCanPostJobs(me.id)]);
      return NextResponse.json({ role: "client", canPost: post.allowed, plan: post.plan, categories: cats, jobs });
    }

    const access = await creatorJobAccess(me.id);
    if (!access.canBrowse) {
      const open = await queryOne<RowDataPacket & { n: number }>(
        "SELECT COUNT(*) AS n FROM job_posts WHERE status = 'open' AND expires_at > UTC_TIMESTAMP(3)"
      );
      return NextResponse.json({ role: "creator", locked: true, openCount: Number(open?.n ?? 0), access, categories: cats, jobs: [] });
    }

    const params = new URL(request.url).searchParams;
    const cat = Number(params.get("category"));
    const q = (params.get("q") ?? "").trim().slice(0, 80);
    const jobs = await listOpenJobs(me.id, Number.isInteger(cat) && cat > 0 ? cat : null, q);
    const mine = await queryOne<RowDataPacket & { category_id: number }>("SELECT category_id FROM creator_profiles WHERE user_id = ?", [me.id]);
    return NextResponse.json({ role: "creator", locked: false, access, myCategoryId: mine?.category_id ?? null, categories: cats, jobs });
  } catch (err) {
    console.error("list jobs failed:", err);
    return NextResponse.json({ error: "Could not load the jobs." }, { status: 500 });
  }
}

// A client posts a job (multipart: `payload` = JSON text, `files` = attachments). Top client plan only.
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "client") return NextResponse.json({ error: "Only client accounts can post jobs." }, { status: 403 });

  let rawPayload: unknown;
  let files: File[];
  try {
    const form = await request.formData();
    rawPayload = JSON.parse(String(form.get("payload") ?? ""));
    files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (files.length > MAX_JOB_FILES) {
    return NextResponse.json({ error: `You can attach up to ${MAX_JOB_FILES} files.` }, { status: 400 });
  }

  const savedFiles: string[] = [];
  try {
    const post = await clientCanPostJobs(me.id);
    if (!post.allowed) {
      return NextResponse.json({ error: "Posting jobs is part of the Enterprise plan. Upgrade your membership to post a job." }, { status: 403 });
    }

    const categoryId = Number((rawPayload as { categoryId?: unknown })?.categoryId);
    const category = Number.isInteger(categoryId)
      ? await queryOne<RowDataPacket & { id: number; name: string }>("SELECT id, name FROM categories WHERE id = ? AND is_active = 1", [categoryId])
      : null;
    if (!category) return NextResponse.json({ error: "Please choose a category." }, { status: 400 });

    const data = cleanJob(rawPayload, category.name);

    const open = await queryOne<RowDataPacket & { n: number }>(
      "SELECT COUNT(*) AS n FROM job_posts WHERE client_id = ? AND status = 'open'",
      [me.id]
    );
    if (Number(open?.n ?? 0) >= MAX_OPEN_JOBS) {
      return NextResponse.json({ error: `You already have ${MAX_OPEN_JOBS} open jobs. Close one before posting another.` }, { status: 429 });
    }

    for (const f of files) {
      savedFiles.push((await saveDeliveryFile(f, me.id, "request_attachment", MAX_REQUEST_FILE_BYTES)).id);
    }

    const id = randomUUID();
    await execute(
      `INSERT INTO job_posts
         (id, client_id, category_id, title, summary, brief, details, links,
          budget_type, budget_amount, budget_max, deadline, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? DAY))`,
      [
        id, me.id, category.id, data.title, data.summary, data.brief || null,
        JSON.stringify(data.details), JSON.stringify(data.links),
        data.budget.type, data.budget.amount, data.budget.amountMax, data.deadline, JOB_OPEN_DAYS,
      ]
    );
    for (const fileId of savedFiles) {
      await execute("INSERT INTO job_post_files (job_id, file_id) VALUES (?, ?)", [id, fileId]);
    }
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    await removeFiles(savedFiles).catch(() => {});
    if (err instanceof RequestError || err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("create job failed:", err);
    return NextResponse.json({ error: "Could not post your job." }, { status: 500 });
  }
}
