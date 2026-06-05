import type { ReactNode } from 'react';

type InfoListItem = {
  key: string;
  title: ReactNode;
  detail?: ReactNode;
  className?: string;
};

type InfoListProps = {
  items: InfoListItem[];
  className?: string;
};

export function InfoList({ items, className }: InfoListProps) {
  const classes = ['ui-info-list', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {items.map((item) => (
        <div key={item.key} className={['ui-info-item', item.className ?? ''].filter(Boolean).join(' ')}>
          <strong>{item.title}</strong>
          {item.detail ? <div className="ui-inline-meta">{item.detail}</div> : null}
        </div>
      ))}
    </div>
  );
}
