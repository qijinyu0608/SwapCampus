import type { ElementType, ReactNode } from 'react';

type OrderItemSummaryProps = {
  imageSrc: string;
  imageAlt: string;
  title: ReactNode;
  subtitle?: ReactNode;
  attrs: ReactNode;
  amount: ReactNode;
  actions?: ReactNode;
  className?: string;
  copyClassName?: string;
  attrsClassName?: string;
  amountClassName?: string;
  actionsClassName?: string;
  titleAs?: ElementType;
};

export function OrderItemSummary({
  imageSrc,
  imageAlt,
  title,
  subtitle,
  attrs,
  amount,
  actions,
  className,
  copyClassName,
  attrsClassName,
  amountClassName,
  actionsClassName,
  titleAs = 'h3'
}: OrderItemSummaryProps) {
  const TitleTag = titleAs;
  const rootClasses = ['checkout-order-item', className ?? ''].filter(Boolean).join(' ');
  const copyClasses = ['checkout-item-copy', copyClassName ?? ''].filter(Boolean).join(' ');
  const attrsClasses = ['checkout-item-attrs', attrsClassName ?? ''].filter(Boolean).join(' ');
  const amountClasses = ['checkout-item-price', amountClassName ?? ''].filter(Boolean).join(' ');
  const actionsClasses = ['profile-order-actions', actionsClassName ?? ''].filter(Boolean).join(' ');

  return (
    <div className={rootClasses}>
      <div className="checkout-item-main">
        <img src={imageSrc} alt={imageAlt} />
        <div className={copyClasses}>
          <TitleTag>{title}</TitleTag>
          {subtitle}
        </div>
      </div>

      <div className={attrsClasses}>
        {attrs}
      </div>

      <div className={amountClasses}>
        {amount}
      </div>

      {actions ? (
        <div className={actionsClasses}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}
