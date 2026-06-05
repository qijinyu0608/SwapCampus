import type { ReactNode } from 'react';

type MetaListProps = {
  items: ReactNode[];
  className?: string;
};

export function MetaList({ items, className }: MetaListProps) {
  const classes = ['ui-meta-list', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {items.map((item, index) => (
        <span key={`${String(item)}-${index}`}>
          {item}
          {index < items.length - 1 ? <i /> : null}
        </span>
      ))}
    </div>
  );
}
