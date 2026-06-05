import type { PropsWithChildren, ReactNode } from 'react';

type ActionRowProps = PropsWithChildren<{
  leading?: ReactNode;
  className?: string;
}>;

export function ActionRow({ leading, className, children }: ActionRowProps) {
  const classes = ['ui-action-row', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {leading ? <div className="ui-action-row-leading">{leading}</div> : null}
      <div className="ui-action-row-actions">{children}</div>
    </div>
  );
}
