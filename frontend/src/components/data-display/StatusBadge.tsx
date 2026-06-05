import type { ReactNode } from 'react';

type StatusBadgeProps = {
  children: ReactNode;
  tone?: 'default' | 'warning' | 'info' | 'success';
  className?: string;
};

export function StatusBadge({ children, tone = 'default', className }: StatusBadgeProps) {
  const classes = ['ui-status-badge', `is-${tone}`, className ?? ''].filter(Boolean).join(' ');
  return <span className={classes}>{children}</span>;
}
