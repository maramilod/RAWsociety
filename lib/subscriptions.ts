import { queryOne, type RowDataPacket } from "@/lib/db";
import { APPLICATIONS_PER_MONTH, CAN_POST_JOBS, FREE_PLAN } from "@/lib/plan-rules";

export type PlanAudience = "creator" | "client";

/** The code of the plan a user is on right now: a paid plan that has not ended, otherwise the free plan. */
export async function currentPlanCode(userId: string, audience: PlanAudience): Promise<string> {
  const row = await queryOne<RowDataPacket & { code: string }>(
    `SELECT p.code
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ? AND s.status = 'active' AND s.current_period_end > UTC_TIMESTAMP(3)
      ORDER BY p.sort_order DESC LIMIT 1`,
    [userId]
  );
  return row?.code ?? FREE_PLAN[audience];
}

export interface CreatorJobAccess {
  plan: string;
  canBrowse: boolean; // the free plan cannot even read the jobs
  limit: number | null; // applications per month, null = unlimited
  used: number;
  remaining: number | null; // null = unlimited
}

/** Applications a creator has sent this calendar month (withdrawn ones still count, so the limit cannot be reused). */
export async function applicationsThisMonth(creatorId: string): Promise<number> {
  const row = await queryOne<RowDataPacket & { n: number }>(
    `SELECT COUNT(*) AS n FROM job_applications
      WHERE creator_id = ? AND created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')`,
    [creatorId]
  );
  return Number(row?.n ?? 0);
}

export async function creatorJobAccess(creatorId: string): Promise<CreatorJobAccess> {
  const plan = await currentPlanCode(creatorId, "creator");
  const limit = plan in APPLICATIONS_PER_MONTH ? APPLICATIONS_PER_MONTH[plan] : 0;
  const used = await applicationsThisMonth(creatorId);
  return {
    plan,
    canBrowse: limit === null || limit > 0,
    limit,
    used,
    remaining: limit === null ? null : Math.max(limit - used, 0),
  };
}

export async function clientCanPostJobs(clientId: string): Promise<{ plan: string; allowed: boolean }> {
  const plan = await currentPlanCode(clientId, "client");
  return { plan, allowed: CAN_POST_JOBS.includes(plan) };
}

/** True when the user has never had a paid membership start (a rejected or waiting request does not count). */
export async function neverPaid(userId: string): Promise<boolean> {
  const row = await queryOne<RowDataPacket & { n: number }>(
    "SELECT COUNT(*) AS n FROM subscriptions WHERE user_id = ? AND current_period_start IS NOT NULL",
    [userId]
  );
  return Number(row?.n ?? 0) === 0;
}

export interface OnboardingState {
  /** The first paid plan the user chose at sign-up is waiting for the admin: the dashboard stays closed. */
  pending: { code: string; name: string } | null;
  /** The admin rejected that first payment: the user is back on the free plan. Shown once, until acknowledged. */
  rejection: { id: string; reason: string; logoRemoved: boolean } | null;
}

export async function onboardingState(userId: string): Promise<OnboardingState> {
  const pending = (await neverPaid(userId))
    ? await queryOne<RowDataPacket & { code: string; name: string }>(
        `SELECT pl.code, pl.name
           FROM subscriptions s JOIN plans pl ON pl.id = s.plan_id
           JOIN payments pa ON pa.subscription_id = s.id AND pa.status = 'pending'
          WHERE s.user_id = ? AND s.status = 'pending' ORDER BY pa.created_at DESC LIMIT 1`,
        [userId]
      )
    : null;
  const note = await queryOne<RowDataPacket & { id: string; data: unknown }>(
    `SELECT id, data FROM notifications
      WHERE user_id = ? AND type = 'payment' AND read_at IS NULL
        AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.kind')) = 'onboarding_rejected'
      ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  let rejection: OnboardingState["rejection"] = null;
  if (note) {
    const d = (typeof note.data === "string" ? JSON.parse(note.data) : note.data) as { reason?: string; logoRemoved?: boolean };
    rejection = { id: note.id, reason: String(d?.reason ?? ""), logoRemoved: !!d?.logoRemoved };
  }
  return { pending: pending ? { code: pending.code, name: pending.name } : null, rejection };
}

/** The explore page a logged-in client must see: the limited one on the free plan, the full one otherwise. null = no rule (guests, creators). */
export async function exploreRouteFor(user: { id: string; role: string } | null): Promise<"/explore" | "/explore/free" | null> {
  if (!user || user.role !== "client") return null;
  return (await currentPlanCode(user.id, "client")) === FREE_PLAN.client ? "/explore/free" : "/explore";
}
