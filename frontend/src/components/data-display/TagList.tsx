import type { ReactNode } from 'react';

type TagListItem = {
  key: string;
  label: ReactNode;
  tone?: 'default' | 'success';
};

type TagListProps = {
  items: TagListItem[];
  compact?: boolean;
  className?: string;
};

export function TagList({ items, compact = false, className }: TagListProps) {
  const classes = ['ui-tag-list', compact ? 'is-compact' : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {items.map((item) => (
        <span key={item.key} className={item.tone === 'success' ? 'ui-tag-chip is-success' : 'ui-tag-chip'}>
          {item.label}
        </span>
      ))}
    </div>
  );
}
