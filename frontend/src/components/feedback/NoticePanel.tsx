import type { PropsWithChildren, ReactNode } from 'react';

type NoticePanelProps = PropsWithChildren<{
  title: ReactNode;
  description?: ReactNode;
  tone?: 'default' | 'danger';
  className?: string;
}>;

export function NoticePanel({ title, description, tone = 'default', className, children }: NoticePanelProps) {
  const classes = ['ui-notice-panel', tone === 'danger' ? 'is-danger' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="ui-notice-copy">
        <strong>{title}</strong>
        {description ? <span>{description}</span> : null}
      </div>
      {children ? <div className="ui-notice-actions">{children}</div> : null}
    </div>
  );
}
