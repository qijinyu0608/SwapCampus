import { Rate } from 'antd';
import { UserNameWithBadge } from './UserNameWithBadge';

type UserReviewCardProps = {
  reviewerName: string;
  createdAt: string;
  rating: number;
  content: string;
  reviewerTrustedBadgeUnlocked?: boolean;
};

export function UserReviewCard({
  reviewerName,
  createdAt,
  rating,
  content,
  reviewerTrustedBadgeUnlocked = false
}: UserReviewCardProps) {
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
      <Rate disabled value={rating} className="profile-review-rate" />
      <p>{content}</p>
    </article>
  );
}
