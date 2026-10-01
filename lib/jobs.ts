import { execute, query, type RowDataPacket } from "@/lib/db";
import { parseDeliveryLinks } from "@/lib/deliveries";
import { MAX_JOB_LINKS } from "@/lib/plan-rules";
import { RequestError, cleanDetails, money, obj, oneOf, optionalText, text } from "@/lib/custom-requests";
import { CLIENT_INFO_COLUMNS, toClientInfo, type ClientInfoRow } from "@/lib/client-info";
import type { FieldValue } from "@/components/hire/fields";
import type {
  ApplicationForClient,
  ApplicationStatus,
  JobBudget,
  JobLink,
  JobRow,
  JobStatus,
  MyApplication,
} from "@/lib/job-types";

export { RequestError };

export interface CleanJob {
  categoryId: number;
  title: string;
  summary: string;
  brief: string;
  details: Record<string, FieldValue>;
  links: { kind: string; label: string | null; url: string }[];
  budget: { type: "fixed" | "range" | "quote"; amount: number | null; amountMax: number | null };
  deadline: string | null;
}

/** Reads a job sent by the form. `categoryName` comes from the database and decides which questions exist. */
export function cleanJob(raw: unknown, categoryName: string): CleanJob {
  const b = obj(raw);
  const budget = obj(b.budget);
  const type = oneOf(budget.type, ["fixed", "range", "quote"], "budget type") as CleanJob["budget"]["type"];
  let amount: number | null = null;
  let amountMax: number | null = null;
  if (type === "fixed") amount = money(budget.amount, "The price");
  if (type === "range") {
    amount = money(budget.amount, "The lowest price");
    amountMax = money(budget.amountMax, "The highest price");
    if (amountMax < amount) throw new RequestError("The highest price must be equal to or more than the lowest.");
  }

  let deadline: string | null = null;
  if (b.deadline) {
    const d = String(b.deadline);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) throw new RequestError("The deadline is not a valid date.");
    if (d <= new Date().toISOString().slice(0, 10)) throw new RequestError("The deadline must be a future date.");
    deadline = d;
  }

  const links = Array.isArray(b.links) ? b.links : [];
  if (links.length > MAX_JOB_LINKS) throw new RequestError(`You can add up to ${MAX_JOB_LINKS} links.`);

  return {
    categoryId: Number(b.categoryId),
    title: text(b.title, "The title", 5, 120),
    summary: text(b.summary, "The description", 30, 1500),
    brief: optionalText(b.brief, "The detailed brief", 5000),
    details: cleanDetails(b.details, categoryName),
    links: parseDeliveryLinks(JSON.stringify(links)),
    budget: { type, amount, amountMax },
    deadline,
  };
}

/** Jobs nobody filled end on their own, and their unanswered applications close with them. Called whenever jobs are read. */
export async function sweepJobs(): Promise<void> {
  await execute("UPDATE job_posts SET status = 'expired' WHERE status = 'open' AND expires_at < UTC_TIMESTAMP(3)");
  await execute(
    `UPDATE job_applications a JOIN job_posts j ON j.id = a.job_id
        SET a.status = 'rejected'
      WHERE a.status = 'pending' AND j.status IN ('closed','expired')`
  );
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

interface DbJob extends RowDataPacket, Partial<Omit<ClientInfoRow, keyof RowDataPacket>> {
  id: string;
  client_id: string;
  client_name: string;
  category_id: number;
  category_name: string;
  title: string;
  summary: string;
  brief: string | null;
  details: unknown;
  links: unknown;
  budget_type: JobBudget["type"];
  budget_amount: string | null;
  budget_max: string | null;
  currency: string;
  deadline: Date | null;
  status: JobStatus;
  expires_at: Date;
  created_at: Date;
  applications_count: number;
  my_app_id: string | null;
  my_app_status: ApplicationStatus | null;
  my_app_price: string | null;
  my_app_days: number | null;
}

export const JOB_COLUMNS = `j.id, j.client_id, u.name AS client_name, j.category_id, cat.name AS category_name,
  j.title, j.summary, j.brief, j.details, j.links, j.budget_type, j.budget_amount, j.budget_max, j.currency,
  j.deadline, j.status, j.expires_at, j.created_at,
  (SELECT COUNT(*) FROM job_applications a WHERE a.job_id = j.id AND a.status <> 'withdrawn') AS applications_count`;

/**
 * Turns job rows into JobRows, loading their files.
 * `viewer` decides what is attached: a creator gets the client's card and their own application,
 * a client gets the list of everybody who applied.
 */
export async function buildJobs(rows: DbJob[], viewer: "creator" | "client"): Promise<JobRow[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const files = await query<RowDataPacket & { job_id: string; id: string; original_name: string; size_bytes: string }>(
    `SELECT jf.job_id, f.id, f.original_name, f.size_bytes
       FROM job_post_files jf JOIN files f ON f.id = jf.file_id
      WHERE jf.job_id IN (?) ORDER BY f.created_at`,
    [ids]
  );

  const byJob = new Map<string, ApplicationForClient[]>();
  if (viewer === "client") {
    const apps = await query<
      RowDataPacket & {
        id: string; job_id: string; status: ApplicationStatus; price: string; days: number; message: string | null;
        links: unknown; created_at: Date; order_number: string | null; creator_id: string; creator_name: string;
        creator_image: string | null; category: string; rating: string; reviews: number; completed: number;
      }
    >(
      `SELECT a.id, a.job_id, a.status, a.price, a.days, a.message, a.links, a.created_at, o.order_number,
              u.id AS creator_id, u.name AS creator_name, u.image AS creator_image, cat.name AS category,
              p.rating_avg AS rating, p.reviews_count AS reviews, p.projects_completed AS completed
         FROM job_applications a
         JOIN users u ON u.id = a.creator_id
         JOIN creator_profiles p ON p.user_id = a.creator_id
         JOIN categories cat ON cat.id = p.category_id
         LEFT JOIN orders o ON o.id = a.order_id
        WHERE a.job_id IN (?) AND a.status <> 'withdrawn'
        ORDER BY FIELD(a.status, 'accepted', 'pending', 'rejected'), a.created_at`,
      [ids]
    );
    for (const a of apps) {
      const list = byJob.get(a.job_id) ?? [];
      list.push({
        id: a.id,
        status: a.status,
        price: Number(a.price),
        days: a.days,
        message: a.message ?? "",
        links: parseJson<JobLink[]>(a.links, []),
        createdAt: a.created_at.toISOString(),
        orderNumber: a.order_number,
        creator: {
          id: a.creator_id,
          name: a.creator_name,
          image: a.creator_image,
          category: a.category,
          rating: Number(a.rating),
          reviews: a.reviews,
          completed: a.completed,
        },
      });
      byJob.set(a.job_id, list);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    brief: r.brief ?? "",
    category: { id: r.category_id, name: r.category_name },
    details: parseJson<Record<string, FieldValue>>(r.details, {}),
    links: parseJson<JobLink[]>(r.links, []),
    files: files.filter((f) => f.job_id === r.id).map((f) => ({ id: f.id, name: f.original_name, size: Number(f.size_bytes) })),
    budget: { type: r.budget_type, amount: num(r.budget_amount), amountMax: num(r.budget_max), currency: r.currency },
    deadline: r.deadline ? r.deadline.toISOString().slice(0, 10) : null,
    status: r.status,
    expiresAt: r.expires_at.toISOString(),
    createdAt: r.created_at.toISOString(),
    applicationsCount: Number(r.applications_count),
    client:
      viewer === "creator" && r.ci_joined
        ? { id: r.client_id, name: r.client_name, ...toClientInfo(r as unknown as ClientInfoRow) }
        : null,
    myApplication:
      viewer === "creator" && r.my_app_id && r.my_app_status
        ? { id: r.my_app_id, status: r.my_app_status, price: Number(r.my_app_price), days: r.my_app_days ?? 0 }
        : null,
    applications: viewer === "client" ? (byJob.get(r.id) ?? []) : null,
  }));
}

/** Open jobs for a creator to browse, with the client's card and the creator's own application. */
export async function listOpenJobs(creatorId: string, categoryId: number | null, q: string): Promise<JobRow[]> {
  const where = ["j.status = 'open'", "j.expires_at > UTC_TIMESTAMP(3)", "u.deleted_at IS NULL", "u.status = 'active'"];
  const params: unknown[] = [creatorId];
  if (categoryId) {
    where.push("j.category_id = ?");
    params.push(categoryId);
  }
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (m) => "\\" + m)}%`;
    where.push("(j.title LIKE ? OR j.summary LIKE ?)");
    params.push(like, like);
  }
  const rows = await query<DbJob>(
    `SELECT ${JOB_COLUMNS}, ${CLIENT_INFO_COLUMNS},
            ma.id AS my_app_id, ma.status AS my_app_status, ma.price AS my_app_price, ma.days AS my_app_days
       FROM job_posts j
       JOIN users u ON u.id = j.client_id
       JOIN categories cat ON cat.id = j.category_id
       LEFT JOIN client_profiles clp ON clp.user_id = u.id
       LEFT JOIN files cf ON cf.id = clp.logo_file_id
       LEFT JOIN job_applications ma ON ma.job_id = j.id AND ma.creator_id = ?
      WHERE ${where.join(" AND ")}
      ORDER BY j.created_at DESC LIMIT 50`,
    params
  );
  return buildJobs(rows, "creator");
}

/** A client's own jobs with everybody who applied. */
export async function listClientJobs(clientId: string): Promise<JobRow[]> {
  const rows = await query<DbJob>(
    `SELECT ${JOB_COLUMNS}
       FROM job_posts j
       JOIN users u ON u.id = j.client_id
       JOIN categories cat ON cat.id = j.category_id
      WHERE j.client_id = ? ORDER BY j.created_at DESC LIMIT 100`,
    [clientId]
  );
  return buildJobs(rows, "client");
}

/** A creator's applications, newest first. */
export async function listMyApplications(creatorId: string): Promise<MyApplication[]> {
  const rows = await query<
    RowDataPacket & {
      id: string; status: ApplicationStatus; price: string; days: number; message: string | null; created_at: Date;
      order_number: string | null; job_id: string; title: string; job_status: JobStatus; client_name: string;
      budget_type: JobBudget["type"]; budget_amount: string | null; budget_max: string | null; currency: string;
    }
  >(
    `SELECT a.id, a.status, a.price, a.days, a.message, a.created_at, o.order_number,
            j.id AS job_id, j.title, j.status AS job_status, u.name AS client_name,
            j.budget_type, j.budget_amount, j.budget_max, j.currency
       FROM job_applications a
       JOIN job_posts j ON j.id = a.job_id
       JOIN users u ON u.id = j.client_id
       LEFT JOIN orders o ON o.id = a.order_id
      WHERE a.creator_id = ? ORDER BY a.created_at DESC LIMIT 100`,
    [creatorId]
  );
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    price: Number(r.price),
    days: r.days,
    message: r.message ?? "",
    createdAt: r.created_at.toISOString(),
    orderNumber: r.order_number,
    job: {
      id: r.job_id,
      title: r.title,
      status: r.job_status,
      clientName: r.client_name,
      budget: { type: r.budget_type, amount: num(r.budget_amount), amountMax: num(r.budget_max), currency: r.currency },
    },
  }));
}
