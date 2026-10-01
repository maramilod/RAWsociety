import { NextResponse } from "next/server";
import { query, queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { applicationsThisMonth, clientAccess, clientHasDashboard, currentPlanCode, onboardingState } from "@/lib/subscriptions";
import { APPLICATIONS_PER_MONTH, clientPlanFeatures, creatorPlanFeatures } from "@/lib/plan-rules";

interface PlanRow extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  price: string;
  currency: string;
  features: unknown;
  sort_order: number;
}

function parseList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

// The plans a user can choose from, the one they are on, and a payment that is waiting for the admin
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "client" && me.role !== "creator") {
    return NextResponse.json({ error: "Not available for this account." }, { status: 403 });
  }
  try {
    const plans = await query<PlanRow>(
      "SELECT id, code, name, price, currency, features, sort_order FROM plans WHERE audience = ? AND is_active = 1 ORDER BY sort_order",
      [me.role]
    );
    const code = await currentPlanCode(me.id, me.role);
    const active = await queryOne<RowDataPacket & { code: string; period_end: Date }>(
      `SELECT p.code, s.current_period_end AS period_end
         FROM subscriptions s JOIN plans p ON p.id = s.plan_id
        WHERE s.user_id = ? AND s.status = 'active' AND s.current_period_end > UTC_TIMESTAMP(3)
        ORDER BY p.sort_order DESC LIMIT 1`,
      [me.id]
    );
    const pending = await queryOne<RowDataPacket & { name: string; code: string }>(
      `SELECT pl.name, pl.code
         FROM subscriptions s JOIN plans pl ON pl.id = s.plan_id
         JOIN payments pa ON pa.subscription_id = s.id AND pa.status = 'pending'
        WHERE s.user_id = ? AND s.status = 'pending' ORDER BY pa.created_at DESC LIMIT 1`,
      [me.id]
    );
    const onboarding = await onboardingState(me.id);
    const currentOrder = plans.find((p) => p.code === code)?.sort_order ?? 1;

    return NextResponse.json({
      role: me.role,
      current: { code, periodEnd: active ? active.period_end.toISOString() : null },
      pending: pending ? { code: pending.code, name: pending.name } : null,
      onboarding,
      usage:
        me.role === "creator"
          ? { limit: APPLICATIONS_PER_MONTH[code] ?? 0, used: await applicationsThisMonth(me.id) }
          : null,
      hasDashboard: me.role === "client" ? await clientHasDashboard(me.id) : true,
      clientUsage:
        me.role === "client"
          ? await clientAccess(me.id).then((a) => ({
              hireMe: { used: a.hireMeUsed, limit: a.rules.hireMePerMonth },
              messages: { used: a.messagesUsed, limit: a.rules.messagesPerMonth },
            }))
          : null,
      plans: plans.map((p) => ({
        code: p.code,
        name: p.name,
        price: Number(p.price),
        currency: p.currency,
        features: me.role === "client" ? clientPlanFeatures(p.code) : creatorPlanFeatures(p.code),
        // what this plan gets on the jobs board
        // the jobs line is part of the features now
        jobs: "",
        isCurrent: p.code === code,
        canBuy: Number(p.price) > 0 && (p.code === code || p.sort_order > currentOrder),
      })),
    });
  } catch (err) {
    console.error("membership failed:", err);
    return NextResponse.json({ error: "Could not load the plans." }, { status: 500 });
  }
}
