import type { ReactNode } from 'react';

type DetailInfoTopSummaryProps = {
  stats: ReactNode[];
  favoriteButton?: ReactNode;
  amount: ReactNode;
};

export function DetailInfoTopSummary({ stats, favoriteButton, amount }: DetailInfoTopSummaryProps) {
  return (
    <>
      <div className="detail-topline">
        <div className="detail-heat-line">
          {stats.map((item, index) => (
            <span key={`${String(item)}-${index}`}>{item}</span>
          ))}
        </div>
        {favoriteButton}
      </div>

      <div className="detail-price-block">
        <div className="listing-detail-amount">
          {amount}
        </div>
      </div>
    </>
  );
}
