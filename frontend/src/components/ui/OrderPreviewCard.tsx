import type { ComponentProps, ReactNode } from 'react';
import { OrderCounterpartHeader } from './OrderCounterpartHeader';
import { OrderItemSummary } from './OrderItemSummary';

type OrderPreviewCardProps = {
  articleClassName?: string;
  cardClassName?: string;
  headerProps?: ComponentProps<typeof OrderCounterpartHeader>;
  summaryProps: ComponentProps<typeof OrderItemSummary>;
  beforeSummary?: ReactNode;
  afterSummary?: ReactNode;
};

export function OrderPreviewCard({
  articleClassName,
  cardClassName,
  headerProps,
  summaryProps,
  beforeSummary,
  afterSummary
}: OrderPreviewCardProps) {
  const cardClasses = ['checkout-shop-card', cardClassName ?? ''].filter(Boolean).join(' ');
  const content = (
    <div className={cardClasses}>
      {headerProps ? <OrderCounterpartHeader {...headerProps} /> : null}
      {beforeSummary}
      <OrderItemSummary {...summaryProps} />
      {afterSummary}
    </div>
  );

  if (!articleClassName) {
    return content;
  }

  return (
    <article className={articleClassName}>
      {content}
    </article>
  );
}
