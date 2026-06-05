import type { ReactNode } from 'react';

type KeyValueItem = {
  key: string;
  label: ReactNode;
  value: ReactNode;
};

type KeyValueGridProps = {
  items: KeyValueItem[];
  columns?: number;
  className?: string;
  emphasizeValue?: boolean;
};

export function KeyValueGrid({ items, columns, className, emphasizeValue = false }: KeyValueGridProps) {
  const classes = ['ui-key-value-grid', emphasizeValue ? 'is-emphasis' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      style={columns ? ({ ['--key-value-columns' as string]: String(columns) }) : undefined}
    >
      {items.map((item) => (
        <div key={item.key} className="ui-key-value-item">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
