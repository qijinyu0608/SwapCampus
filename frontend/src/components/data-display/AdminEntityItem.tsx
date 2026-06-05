import type { PropsWithChildren, ReactNode } from 'react';

type AdminEntityItemProps = PropsWithChildren<{
  title?: ReactNode;
  meta?: ReactNode;
  side?: ReactNode;
  variant?: 'default' | 'report';
  className?: string;
}>;

export function AdminEntityItem({
  title,
  meta,
  side,
  variant = 'default',
  className,
  children
}: AdminEntityItemProps) {
  const classes = ['ui-admin-entity', variant === 'report' ? 'is-report' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="ui-admin-entity-main">
        {title ? <strong>{title}</strong> : null}
        {children}
        {meta ? <div className="ui-admin-entity-meta">{meta}</div> : null}
      </div>
      {side ? <div className="ui-admin-entity-side">{side}</div> : null}
    </div>
  );
}
