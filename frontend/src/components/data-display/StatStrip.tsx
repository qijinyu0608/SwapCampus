import type { ReactNode } from 'react';

type StatStripItem = {
  key: string;
  value: ReactNode;
  label: ReactNode;
  emphasis?: 'lead' | 'default';
};

type StatStripProps = {
  items: StatStripItem[];
  columns?: number;
  className?: string;
  itemClassName?: string;
};

export function StatStrip({ items, columns, className, itemClassName }: StatStripProps) {
  const classes = ['ui-stat-strip', className ?? ''].filter(Boolean).join(' ');
  const itemClasses = ['ui-stat-card', itemClassName ?? ''].filter(Boolean).join(' ');

  return (
    <section
      className={classes}
      style={columns ? ({ ['--stat-strip-columns' as string]: String(columns) }) : undefined}
    >
      {items.map((item) => (
        <div key={item.key} className={item.emphasis === 'lead' ? `${itemClasses} is-lead` : itemClasses}>
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </section>
  );
}
