import { Card, Typography } from 'antd';
import type { PropsWithChildren, ReactNode } from 'react';

type SectionCardProps = PropsWithChildren<{
  title?: ReactNode;
  extra?: ReactNode;
  className?: string;
  compact?: boolean;
}>;

export function SectionCard({ title, extra, className, compact = false, children }: SectionCardProps) {
  const classes = ['ui-section-card', compact ? 'is-compact' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <Card className={classes}>
      {title || extra ? (
        <div className="ui-section-card-head">
          <div className="ui-section-card-title-wrap">
            {typeof title === 'string' ? (
              <Typography.Title level={3} className="ui-section-card-title">
                {title}
              </Typography.Title>
            ) : (
              title
            )}
          </div>
          {extra ? <div className="ui-section-card-extra">{extra}</div> : null}
        </div>
      ) : null}
      {children}
    </Card>
  );
}
