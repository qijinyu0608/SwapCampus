import type { PropsWithChildren } from 'react';

type AdminEntityActionsProps = PropsWithChildren<{
  wrap?: boolean;
  className?: string;
}>;

export function AdminEntityActions({ wrap = false, className, children }: AdminEntityActionsProps) {
  const classes = ['ui-admin-entity-actions', wrap ? 'is-wrap' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
}
