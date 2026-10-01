import { execute } from "@/lib/db";
import { AUTO_APPROVE_DAYS } from "@/lib/payments/config";

/**
 * Time-based rules, applied whenever orders are read (the dashboards refresh every few seconds,
 * so nothing needs a separate scheduled job):
 *
 *  1. An accepted order that is still unpaid after the payment window expires.
 *     (Not while a payment is waiting for the admin: the client did pay, so we must not cancel.)
 *  2. A delivered order that the client never answered counts as approved after AUTO_APPROVE_DAYS.
 *     The creator's money is then released, exactly as if the client had pressed Approve.
 */
export async function runOrderSweeps(): Promise<void> {
  await execute(
    `UPDATE orders o
        SET o.status = 'cancelled', o.cancelled_by = 'system'
      WHERE o.status = 'awaiting_payment'
        AND o.payment_due_at IS NOT NULL
        AND o.payment_due_at < UTC_TIMESTAMP(3)
        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'pending')`
  );

  await execute(
    `UPDATE orders
        SET status = 'completed',
            payout_status = IF(payout_status = 'held', 'released', payout_status)
      WHERE status = 'in_review'
        AND delivered_at IS NOT NULL
        AND delivered_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? DAY)`,
    [AUTO_APPROVE_DAYS]
  );
}
