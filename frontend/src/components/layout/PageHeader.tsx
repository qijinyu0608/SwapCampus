import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, meta, className }: PageHeaderProps) {
  const classes = ['ui-page-header', className ?? ''].filter(Boolean).join(' ');

  return (
    <section className={classes}>
      <div className="ui-page-header-copy">
        <h1>{title}</h1>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      {meta ? <div className="ui-page-header-meta">{meta}</div> : null}
    </section>
  );
}
