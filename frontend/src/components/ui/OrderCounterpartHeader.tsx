import type { ReactNode } from 'react';
import { UserAvatar, type AvatarFrameKey } from '../user/UserAvatar';
import type { UserCreditBadgeTone } from '../../utils/userPresentation';
import { CreditBadge } from './CreditBadge';

type ProfileOrderIdentityProps = {
  avatarSrc?: string | null;
  avatarAlt: string;
  fallbackLabel: string;
  avatarFrame?: AvatarFrameKey | null;
  name: ReactNode;
  statusTag?: ReactNode;
};

export function ProfileOrderIdentity({
  avatarSrc,
  avatarAlt,
  fallbackLabel,
  avatarFrame,
  name,
  statusTag
}: ProfileOrderIdentityProps) {
  return (
    <>
      <UserAvatar
        src={avatarSrc}
        alt={avatarAlt}
        fallbackLabel={fallbackLabel}
        className="profile-order-avatar"
        frame={avatarFrame ?? undefined}
      />
      <div className="profile-order-user-copy">
        <strong>{name}</strong>
        {statusTag}
      </div>
    </>
  );
}

type OrderCounterpartHeaderProps = {
  copyContent: ReactNode;
  creditTone: UserCreditBadgeTone;
  creditLabel: string;
  conversationButton?: ReactNode;
  ariaLabel?: string;
  copyClassName?: string;
  actionsClassName?: string;
};

export function OrderCounterpartHeader({
  copyContent,
  creditTone,
  creditLabel,
  conversationButton,
  ariaLabel = '订单对象信息',
  copyClassName,
  actionsClassName
}: OrderCounterpartHeaderProps) {
  const copyClasses = ['checkout-shop-copy', 'is-inline', copyClassName ?? ''].filter(Boolean).join(' ');
  const actionClasses = ['checkout-shop-actions', actionsClassName ?? ''].filter(Boolean).join(' ');

  return (
    <div className="checkout-shop-info" aria-label={ariaLabel}>
      <div className={copyClasses}>
        {copyContent}
      </div>
      <div className={actionClasses}>
        {conversationButton}
        <CreditBadge tone={creditTone} label={creditLabel} />
      </div>
    </div>
  );
}
