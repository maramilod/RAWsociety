// Payment rules in one place. Change a number here (or the environment variable) and the whole site follows.

/** How much of each order the platform keeps. Set PLATFORM_COMMISSION_RATE=0.15 for 15%. */
export const COMMISSION_RATE = (() => {
  const raw = Number(process.env.PLATFORM_COMMISSION_RATE ?? "0.10");
  return Number.isFinite(raw) && raw >= 0 && raw <= 0.5 ? raw : 0.1;
})();

/** After a creator accepts, the client has this long to pay before the order expires. */
export const PAYMENT_WINDOW_HOURS = 48;

/** After delivery, the client has this long to respond. After that the delivery counts as approved. */
export const AUTO_APPROVE_DAYS = 5;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Splits an order amount into the platform's commission and what the creator receives. */
export function splitAmount(amount: number): { fee: number; payout: number } {
  const fee = round2(amount * COMMISSION_RATE);
  return { fee, payout: round2(amount - fee) };
}
