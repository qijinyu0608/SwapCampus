import { UserNameWithBadge } from './UserNameWithBadge';

type UserReviewCardProps = {
  reviewerName: string;
  createdAt: string;
  rating: number;
  content: string;
  reviewerTrustedBadgeUnlocked?: boolean;
};

function parseCompositeRating(content: string) {
  const match = content.match(/综合评分[:：]\s*([0-5](?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(5, value));
}

const STAR_PATH =
  'M908.1 353.1l-253.9-36.9L540.7 86.1c-3.1-6.3-8.2-11.4-14.5-14.5-15.8-7.8-35-1.3-42.9 14.5L369.8 316.2l-253.9 36.9c-7 1-13.4 4.3-18.3 9.3a32.05 32.05 0 00.6 45.3l183.7 179.1-43.4 252.9a31.95 31.95 0 0046.4 33.7L512 754l227.1 119.4c6.2 3.3 13.4 4.4 20.3 3.2 17.4-3 29.1-19.5 26.1-36.9l-43.4-252.9 183.7-179.1c5-4.9 8.3-11.3 9.3-18.3 2.7-17.5-9.5-33.7-27-36.3z';

function ReviewStarIcon() {
  return (
    <svg viewBox="64 64 896 896" aria-hidden="true" focusable="false" className="user-review-rate-star-icon">
      <path d={STAR_PATH} fill="currentColor" />
    </svg>
  );
}

function ReviewStarDisplay({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(5, value));

  return (
    <div className="user-review-rate" role="img" aria-label={`评分 ${safeValue.toFixed(1)} / 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const fillRatio = Math.max(0, Math.min(1, safeValue - index));

        return (
          <span key={index} className="user-review-rate-star" aria-hidden="true">
            <span className="user-review-rate-star-outline">
              <ReviewStarIcon />
            </span>
            <span
              className="user-review-rate-star-fill"
              style={{
                clipPath: `inset(0 ${100 - fillRatio * 100}% 0 0)`
              }}
            >
              <ReviewStarIcon />
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function UserReviewCard({
  reviewerName,
  createdAt,
  rating,
  content,
  reviewerTrustedBadgeUnlocked = false
}: UserReviewCardProps) {
  const displayRating = Math.round((parseCompositeRating(content) ?? rating) * 2) / 2;

  return (
    <article className="order-detail-review-card">
      <div className="order-detail-review-top">
        <UserNameWithBadge
          as="strong"
          name={reviewerName}
          trustedBadgeUnlocked={reviewerTrustedBadgeUnlocked}
        />
        <span>{new Date(createdAt).toLocaleString()}</span>
      </div>
      <ReviewStarDisplay value={displayRating} />
      <p>{content}</p>
    </article>
  );
}
