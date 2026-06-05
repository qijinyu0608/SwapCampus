import type { ReactNode } from 'react';

type ProductGridProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  emptyState?: ReactNode;
};

export function ProductGrid<T>({ items, renderItem, className, emptyState }: ProductGridProps<T>) {
  if (!items.length) {
    return emptyState ?? null;
  }

  const classes = ['profile-fish-grid', className ?? ''].filter(Boolean).join(' ');

  return <div className={classes}>{items.map(renderItem)}</div>;
}
