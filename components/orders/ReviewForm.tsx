"use client";

import { useState } from "react";

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

type Props = {
  orderId: string;
  creatorName: string;
  onDone: () => void;
  /** Shown only when rating is optional right now (after approving). */
  onSkip?: () => void;
};

/** Stars and a comment. The review cannot be changed afterwards, so the form says so. */
export default function ReviewForm({ orderId, creatorName, onDone, onSkip }: Props) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const shown = hover || rating;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (rating < 1) return setError("Please choose a rating from 1 to 5 stars.");
    setSending(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save your review.");
        return;
      }
      onDone();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <p className="text-sm font-semibold">How was your experience with {creatorName}?</p>
        <p className="text-xs text-[var(--ui-muted)] mt-0.5">
          Your review appears on their profile and helps other clients. You cannot change it later.
        </p>
      </div>

      <div>
        <div
          role="radiogroup"
          aria-label="Rating"
          className="flex items-center gap-1"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(0)}
              className={`text-3xl leading-none transition ${n <= shown ? "text-amber-500" : "text-gray-300"}`}
            >
              ★
            </button>
          ))}
          <span className="ml-3 text-sm font-medium text-[var(--ui-text2)]" aria-live="polite">
            {LABELS[shown]}
          </span>
        </div>
      </div>

      <div>
        <label htmlFor="review-comment" className="block mb-1.5 text-sm font-medium">
          Comment <span className="font-normal text-[var(--ui-muted)]">(optional)</span>
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="What went well? Was the work on time and as agreed?"
          className="w-full rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] p-3 text-sm outline-none focus:border-[#C86C29] focus:ring-2 focus:ring-[#C86C29]/20 resize-none"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={sending}
            className="rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] px-4 py-2 text-xs font-semibold hover:border-[#C86C29] transition"
          >
            Maybe later
          </button>
        )}
        <button
          type="submit"
          disabled={sending}
          className="rounded-xl bg-[#C86C29] px-5 py-2 text-xs font-semibold text-white hover:bg-[#B05B1E] transition disabled:opacity-60"
        >
          {sending ? "Sending..." : "Submit review"}
        </button>
      </div>
    </form>
  );
}
