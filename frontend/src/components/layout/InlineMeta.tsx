import type { ReactNode } from 'react';

type InlineMetaProps = {
  children: ReactNode;
  className?: string;
};

export function InlineMeta({ children, className }: InlineMetaProps) {
  const classes = ['ui-inline-meta', className ?? ''].filter(Boolean).join(' ');
  return <span className={classes}>{children}</span>;
}
