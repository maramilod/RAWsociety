// What each plan allows on the jobs board. Plain constants only, so the server and the browser can both import this file.
// To change a rule, edit it here: the whole site follows. Plan codes are the ones in the `plans` table.

/** How long a paid membership runs. */
export const SUBSCRIPTION_DAYS = 30;

/** Creator plans: applications a creator may send per calendar month. 0 = the jobs board is locked, null = unlimited. */
export const APPLICATIONS_PER_MONTH: Record<string, number | null> = {
  creator_free: 0,
  creator_pro: 3,
  creator_max: null,
};

/**
 * What a client can do on each plan. null = no limit. These numbers drive the server checks AND the text on the plan cards,
 * so the cards always say what is true. Counted per calendar month.
 */
export interface ClientPlanRules {
  /** How many offers the client can see on Explore (null = all) */
  visibleOffers: number | null;
  /** Can the client open creator profiles and see who made an offer? */
  seeCreators: boolean;
  /** Can the client book the listed services? */
  canBook: boolean;
  /** "Hire me" requests (a custom request to one creator) per month */
  hireMePerMonth: number | null;
  /** Messages to creators per month */
  messagesPerMonth: number | null;
  /** A company logo and branding on the client profile */
  branding: boolean;
  /** Post a job that creators apply to */
  postJobs: boolean;
}

export const CLIENT_PLAN_RULES: Record<string, ClientPlanRules> = {
  client_free: { visibleOffers: 6, seeCreators: false, canBook: false, hireMePerMonth: 0, messagesPerMonth: 0, branding: false, postJobs: false },
  client_pro: { visibleOffers: null, seeCreators: true, canBook: true, hireMePerMonth: 3, messagesPerMonth: 50, branding: true, postJobs: false },
  client_enterprise: { visibleOffers: null, seeCreators: true, canBook: true, hireMePerMonth: null, messagesPerMonth: null, branding: true, postJobs: true },
};

export const clientRules = (planCode: string): ClientPlanRules => CLIENT_PLAN_RULES[planCode] ?? CLIENT_PLAN_RULES.client_free;

/** The lines shown on a client plan card, written from the rules above */
export function clientPlanFeatures(planCode: string): string[] {
  const r = clientRules(planCode);
  const lines: string[] = [];
  lines.push(r.visibleOffers === null ? "See all offers and all creators" : `See up to ${r.visibleOffers} offers`);
  if (!r.seeCreators) lines.push("Creator names and profiles stay hidden");
  if (r.canBook) lines.push("Order any listed service, no limit");
  else lines.push("Cannot order services");
  if (r.hireMePerMonth === null) lines.push("Unlimited Hire me requests to the creators you choose");
  else if (r.hireMePerMonth > 0) lines.push(`Hire me: ${r.hireMePerMonth} requests per month`);
  if (r.messagesPerMonth === null) lines.push("Unlimited messages to creators");
  else if (r.messagesPerMonth > 0) lines.push(`Up to ${r.messagesPerMonth} messages per month`);
  else lines.push("No messaging with creators");
  if (r.postJobs) lines.push("Post your own job and receive offers from creators");
  lines.push(r.branding ? "Company identity: logo and branding" : "No company logo or branding");
  return lines;
}

/**
 * What a creator can do on each plan. null = no limit.
 *  - liveServices: how many services can be live at the same time
 *  - requestsPerServicePerMonth: a service that got this many requests (orders) this month closes until the next month
 */
export interface CreatorPlanRules {
  liveServices: number | null;
  requestsPerServicePerMonth: number | null;
}

export const CREATOR_PLAN_RULES: Record<string, CreatorPlanRules> = {
  creator_free: { liveServices: 2, requestsPerServicePerMonth: 3 },
  creator_pro: { liveServices: 15, requestsPerServicePerMonth: null },
  creator_max: { liveServices: null, requestsPerServicePerMonth: null },
};

export const creatorRules = (planCode: string): CreatorPlanRules => CREATOR_PLAN_RULES[planCode] ?? CREATOR_PLAN_RULES.creator_free;

/** The lines shown on a creator plan card, written from the rules above */
export function creatorPlanFeatures(planCode: string): string[] {
  const r = creatorRules(planCode);
  const lines = ["Your own dashboard for orders and requests"];
  lines.push(r.liveServices === null ? "Offer unlimited services" : `Offer up to ${r.liveServices} services at a time`);
  lines.push(
    r.requestsPerServicePerMonth === null
      ? "Unlimited requests"
      : `Each service takes ${r.requestsPerServicePerMonth} requests a month, then closes until next month`
  );
  const apps = APPLICATIONS_PER_MONTH[planCode];
  lines.push(apps === null ? "Unlimited job applications" : apps > 0 ? `Apply to ${apps} jobs per month` : "Jobs board locked");
  return lines;
}

/** Client plans that may post jobs. */
export const CAN_POST_JOBS: string[] = ["client_enterprise"];

/** An open job ends on its own after this many days. */
export const JOB_OPEN_DAYS = 30;
export const MAX_OPEN_JOBS = 10; // per client
export const MAX_JOB_FILES = 5;
export const MAX_JOB_LINKS = 6;
export const MAX_APPLICATION_LINKS = 3;

export const FREE_PLAN: Record<"creator" | "client", string> = { creator: "creator_free", client: "client_free" };
