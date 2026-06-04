import { Card, Typography } from 'antd';
import { PropsWithChildren } from 'react';

export function PageCard({ title, children }: PropsWithChildren<{ title?: string }>) {
  return (
    <Card className="soft-card">
      {title ? <Typography.Title level={3} className="section-title">{title}</Typography.Title> : null}
      {children}
    </Card>
  );
}
