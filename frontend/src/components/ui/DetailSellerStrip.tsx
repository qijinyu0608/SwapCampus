import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MetaList } from '../data-display';
import { UserNameWithBadge } from '../user/UserNameWithBadge';
import { UserAvatar, type AvatarFrameKey } from '../user/UserAvatar';
import { CreditBadge } from './CreditBadge';

type DetailSellerStripProps = {
  userId: number;
  name: string;
  avatarUrl?: string | null;
  avatarFrame?: AvatarFrameKey | null;
  trustedBadgeUnlocked?: boolean;
  creditTone: 'excellent' | 'great' | 'good' | 'stable' | 'low';
  creditLabel: string;
  stats: ReactNode[];
  followButton?: ReactNode;
};

export function DetailSellerStrip({
  userId,
  name,
  avatarUrl,
  avatarFrame,
  trustedBadgeUnlocked = false,
  creditTone,
  creditLabel,
  stats,
  followButton
}: DetailSellerStripProps) {
  return (
    <section className="detail-seller-strip">
      <Link
        to={`/users/${userId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="detail-seller-strip-main detail-seller-link"
        aria-label={`打开${name}的主页`}
      >
        <UserAvatar
          src={avatarUrl}
          alt={`${name}的头像`}
          fallbackLabel={name}
          className="detail-seller-avatar"
          frame={avatarFrame ?? undefined}
        />
        <div className="detail-seller-strip-copy">
          <div className="detail-seller-strip-title">
            <UserNameWithBadge
              as="strong"
              name={name}
              trustedBadgeUnlocked={trustedBadgeUnlocked}
            />
            <CreditBadge tone={creditTone} label={creditLabel} />
          </div>
          <MetaList items={stats} className="detail-seller-strip-meta" />
        </div>
      </Link>
      {followButton}
    </section>
  );
}
