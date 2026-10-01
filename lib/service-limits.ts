import { query, type RowDataPacket } from "@/lib/db";
import { FREE_PLAN, creatorRules } from "@/lib/plan-rules";

export interface ServiceMonthly {
  /** requests (orders) this service got this calendar month */
  used: number;
  /** requests a month this plan allows per service, null = no limit */
  cap: number | null;
  /** closed for the rest of the month */
  full: boolean;
  /** when it opens again (the first day of next month, UTC) */
  reopensAt: string;
}

const MONTH_START = "DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')";

export const nextMonthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
};

/** For each service: its requests this month, the cap of its creator's plan, and whether it is full */
export async function serviceLoad(serviceIds: string[]): Promise<Map<string, ServiceMonthly>> {
  const out = new Map<string, ServiceMonthly>();
  if (serviceIds.length === 0) return out;

  const owners = await query<RowDataPacket & { id: string; creator_id: string }>("SELECT id, creator_id FROM services WHERE id IN (?)", [serviceIds]);
  const creatorIds = [...new Set(owners.map((o) => o.creator_id))];
  const plans = creatorIds.length
    ? await query<RowDataPacket & { user_id: string; code: string }>(
        `SELECT s.user_id, p.code
           FROM subscriptions s JOIN plans p ON p.id = s.plan_id
          WHERE s.user_id IN (?) AND s.status = 'active' AND s.current_period_end > UTC_TIMESTAMP(3) AND p.audience = 'creator'
          ORDER BY p.sort_order ASC`,
        [creatorIds]
      )
    : [];
  const planOf = new Map<string, string>();
  for (const r of plans) planOf.set(r.user_id, r.code); // the highest plan comes last and wins

  const counts = await query<RowDataPacket & { service_id: string; n: number }>(
    `SELECT service_id, COUNT(*) AS n FROM orders
      WHERE service_id IN (?) AND created_at >= ${MONTH_START}
      GROUP BY service_id`,
    [serviceIds]
  );
  const used = new Map(counts.map((c) => [c.service_id, Number(c.n)]));

  const reopensAt = nextMonthStart();
  for (const o of owners) {
    const cap = creatorRules(planOf.get(o.creator_id) ?? FREE_PLAN.creator).requestsPerServicePerMonth;
    const n = used.get(o.id) ?? 0;
    out.set(o.id, { used: n, cap, full: cap !== null && n >= cap, reopensAt });
  }
  return out;
}
