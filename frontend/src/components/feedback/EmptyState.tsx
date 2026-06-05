import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  const classes = ['ui-empty-panel', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
      {action}
    </div>
  );
}
