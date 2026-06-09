import type { KeyboardEvent, ReactNode } from 'react';
import type { ListingSummary } from '../../services/api';

type ProductSummaryCardProps = {
  item: ListingSummary;
  imageSrc: string;
  coverClassName?: string;
  signal?: ReactNode;
  coverMeta?: ReactNode;
  title?: ReactNode;
  bodyMeta?: ReactNode;
  coverActions?: ReactNode;
  secondaryActions?: ReactNode;
  priceValue?: ReactNode;
  priceMeta?: ReactNode;
  tagItems?: ReactNode[];
  className?: string;
  onOpen?: () => void;
};

export function ProductSummaryCard({
  item,
  imageSrc,
  coverClassName,
  signal,
  coverMeta,
  title,
  bodyMeta,
  coverActions,
  secondaryActions,
  priceValue,
  priceMeta,
  tagItems,
  className,
  onOpen
}: ProductSummaryCardProps) {
  const classes = ['fish-item-card', className ?? ''].filter(Boolean).join(' ');
  const normalizedTags = (tagItems ?? []).filter(Boolean);
  const coverClasses = ['fish-item-cover', item.imageUrl ? 'has-image' : '', coverClassName ?? ''].filter(Boolean).join(' ');

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
      <div className={coverClasses}>
        <img className="fish-item-cover-image" src={imageSrc} alt={item.title} />
        {signal ? <span className="fish-item-signal">{signal}</span> : null}
        {coverMeta ? <div className="fish-item-cover-meta">{coverMeta}</div> : null}
        {coverActions}
      </div>
      <div className="fish-item-body">
        <h3>{title ?? item.title}</h3>
        <div className="fish-item-tags-row" aria-label="商品标签">
          {normalizedTags.map((tag, index) => (
            <span key={index} className="fish-item-tag">
              <span className="fish-item-tag-content">{tag}</span>
            </span>
          ))}
        </div>
        {bodyMeta ? <div className="fish-item-body-meta">{bodyMeta}</div> : null}
        <div className="fish-item-price-row">
          <strong>{priceValue ?? `¥${item.price}`}</strong>
          {priceMeta ? <span className="fish-item-price-meta">{priceMeta}</span> : null}
        </div>
        {secondaryActions ? <div className="fish-item-secondary-row">{secondaryActions}</div> : null}
      </div>
    </article>
  );
}
