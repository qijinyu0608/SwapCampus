import type { UserCreditBadgeTone } from '../../utils/userPresentation';

type CreditBadgeProps = {
  tone: UserCreditBadgeTone;
  label: string;
  className?: string;
};

export function CreditBadge({ tone, label, className }: CreditBadgeProps) {
  const classes = ['ui-credit-badge', `is-${tone}`, className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <span className="ui-credit-badge-label">{label}</span>
    </div>
  );
}
