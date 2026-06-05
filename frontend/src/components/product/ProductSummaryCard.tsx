import type { KeyboardEvent, ReactNode } from 'react';
import type { ProductSummary } from '../../services/api';

type ProductSummaryCardProps = {
  item: ProductSummary;
  imageSrc: string;
  signal?: ReactNode;
  secondaryMeta?: ReactNode;
  tertiaryMeta?: ReactNode;
  passiveMeta?: ReactNode;
  className?: string;
  onOpen?: () => void;
};

export function ProductSummaryCard({
  item,
  imageSrc,
  signal,
  secondaryMeta,
  tertiaryMeta,
  passiveMeta,
  className,
  onOpen
}: ProductSummaryCardProps) {
  const classes = ['fish-item-card', className ?? ''].filter(Boolean).join(' ');

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter') {
      onOpen?.();
    }
  }

  return (
    <article
      className={classes}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={onOpen ? handleKeyDown : undefined}
    >
      <div className={item.imageUrl ? 'fish-item-cover has-image' : 'fish-item-cover'}>
        <img className="fish-item-cover-image" src={imageSrc} alt={item.title} />
        {signal ? <span className="fish-item-signal">{signal}</span> : null}
      </div>
      <div className="fish-item-body">
        <h3>{item.title}</h3>
        <div className="fish-item-price-row">
          <strong>¥{item.price}</strong>
          {secondaryMeta ? <span>{secondaryMeta}</span> : null}
        </div>
        {tertiaryMeta ? <div className="fish-item-meta">{tertiaryMeta}</div> : null}
        {passiveMeta ? <div className="fish-item-passive-row">{passiveMeta}</div> : null}
      </div>
    </article>
  );
}
