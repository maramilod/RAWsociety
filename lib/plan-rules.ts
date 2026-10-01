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

/** Client plans that may post jobs. */
export const CAN_POST_JOBS: string[] = ["client_enterprise"];

/** An open job ends on its own after this many days. */
export const JOB_OPEN_DAYS = 30;
export const MAX_OPEN_JOBS = 10; // per client
export const MAX_JOB_FILES = 5;
export const MAX_JOB_LINKS = 6;
export const MAX_APPLICATION_LINKS = 3;

export const FREE_PLAN: Record<"creator" | "client", string> = { creator: "creator_free", client: "client_free" };
