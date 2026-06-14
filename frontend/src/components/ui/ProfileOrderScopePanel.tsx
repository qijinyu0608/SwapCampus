import type { ReactNode } from 'react';

type OrderProgressScope = 'active' | 'ended';

type ProfileOrderScopePanelProps = {
  title: string;
  scope: OrderProgressScope;
  onScopeChange: (scope: OrderProgressScope) => void;
  scopeCounts: Record<OrderProgressScope, number>;
  ariaLabel?: string;
  children: ReactNode;
};

export function ProfileOrderScopePanel({
  title,
  scope,
  onScopeChange,
  scopeCounts,
  ariaLabel,
  children
}: ProfileOrderScopePanelProps) {
  return (
    <div className="profile-order-panel">
      <div className="profile-order-scope" role="tablist" aria-label={ariaLabel ?? `${title}进度筛选`}>
        <button
          type="button"
          className={scope === 'active' ? 'active' : undefined}
          onClick={() => onScopeChange('active')}
        >
          进行中 ({scopeCounts.active})
        </button>
        <button
          type="button"
          className={scope === 'ended' ? 'active' : undefined}
          onClick={() => onScopeChange('ended')}
        >
          已结束 ({scopeCounts.ended})
        </button>
      </div>
      {children}
    </div>
  );
}
