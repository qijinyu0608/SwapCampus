import type { ReactNode } from 'react';

type SectionHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  className?: string;
};

export function SectionHeader({ title, description, aside, className }: SectionHeaderProps) {
  const classes = ['ui-section-header', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="ui-section-header-copy">
        <strong>{title}</strong>
        {description ? <span>{description}</span> : null}
      </div>
      {aside ? <div className="ui-section-header-aside">{aside}</div> : null}
    </div>
  );
}
