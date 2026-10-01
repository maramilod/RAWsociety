"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** A reminder for a creator who has not said where to send their earnings. */
export default function PayoutNotice() {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetch("/api/profile/payout", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMissing(!!d && !d.payout))
      .catch(() => {});
  }, []);

  if (!missing) return null;
  return (
    <div role="status" className="mb-6 flex flex-col gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
      <span>Add your payout details so RAW society knows where to send your earnings.</span>
      <Link href="/onboarding/payout?edit=1" className="font-semibold underline">
        Add payout details
      </Link>
    </div>
  );
}
