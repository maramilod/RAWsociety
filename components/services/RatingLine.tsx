/** "★ 4.5 (2)" for a service. Shows nothing while the service has no reviews yet. */
export default function RatingLine({
  rating,
  count,
  className = "",
}: {
  rating: number | null;
  count: number;
  className?: string;
}) {
  if (rating === null || count <= 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${className}`} aria-label={`Rated ${rating} out of 5 from ${count} ${count === 1 ? "review" : "reviews"}`}>
      <span className="text-amber-500" aria-hidden="true">
        ★
      </span>
      <span>{rating.toFixed(1)}</span>
      <span className="font-normal text-[var(--ui-muted)]">({count})</span>
    </span>
  );
}
