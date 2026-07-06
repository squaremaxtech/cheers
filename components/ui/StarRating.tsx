// avgRatingX100: stars * 100 (e.g. 450 = 4.5 stars), matching workers.avgRating
export default function StarRating({
  avgRatingX100,
  reviewCount,
}: {
  avgRatingX100: number;
  reviewCount?: number;
}) {
  const stars = avgRatingX100 / 100;
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span aria-hidden className="text-gold">
        ★
      </span>
      <span className="text-ink">{stars > 0 ? stars.toFixed(1) : "New"}</span>
      {reviewCount !== undefined && reviewCount > 0 && (
        <span className="text-faint">({reviewCount})</span>
      )}
    </span>
  );
}
