import type { RowDataPacket } from "@/lib/db";
import type { ClientInfo } from "@/lib/request-status";

/**
 * Columns that describe the client of a request or an order, for the creator who has to answer it.
 * Expects the query to join: users u (the client), client_profiles clp, and files cf (clp's logo).
 * Only public-facing facts: the client's budget and project notes are NOT included.
 */
export const CLIENT_INFO_COLUMNS = `clp.industry AS ci_industry, clp.company_size AS ci_size, clp.company_name AS ci_company,
  cf.url AS ci_logo, u.created_at AS ci_joined,
  (SELECT COUNT(*) FROM orders co WHERE co.client_id = u.id AND co.status = 'completed') AS ci_completed,
  (SELECT COUNT(*) FROM orders po WHERE po.client_id = u.id AND po.paid_at IS NOT NULL) AS ci_paid`;

export const CLIENT_INFO_JOINS = `LEFT JOIN client_profiles clp ON clp.user_id = u.id
  LEFT JOIN files cf ON cf.id = clp.logo_file_id`;

export interface ClientInfoRow extends RowDataPacket {
  ci_industry: string | null;
  ci_size: string | null;
  ci_company: string | null;
  ci_logo: string | null;
  ci_joined: Date;
  ci_completed: number;
  ci_paid: number;
}

export function toClientInfo(r: ClientInfoRow): ClientInfo {
  return {
    company: r.ci_company,
    industry: r.ci_industry,
    size: r.ci_size,
    logoUrl: r.ci_logo && !r.ci_logo.startsWith("private:") ? r.ci_logo : null,
    joinedAt: r.ci_joined.toISOString(),
    completedOrders: Number(r.ci_completed),
    paidOrders: Number(r.ci_paid),
  };
}
