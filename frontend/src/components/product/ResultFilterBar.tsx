import { InputNumber } from 'antd';
import type { ReactNode } from 'react';

export type ResultFilterTab = {
  key: string;
  label: string;
};

export type ResultSortOption = {
  key: string;
  label: string;
};

export type ResultCreditOption = {
  key: string;
  label: string;
};

type ResultFilterBarProps = {
  tabs: ResultFilterTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  sortOptions: ResultSortOption[];
  activeSort: string;
  onSortChange: (key: string) => void;
  minPrice?: number | null;
  maxPrice?: number | null;
  onMinPriceChange: (value: number | null) => void;
  onMaxPriceChange: (value: number | null) => void;
  creditOptions?: ResultCreditOption[];
  activeCredit?: string;
  onCreditChange?: (key: string) => void;
  trailingContent?: ReactNode;
};

export function ResultFilterBar({
  tabs,
  activeTab,
  onTabChange,
  sortOptions,
  activeSort,
  onSortChange,
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
  creditOptions,
  activeCredit,
  onCreditChange,
  trailingContent
}: ResultFilterBarProps) {
  return (
    <div className="result-filter-bar">
      <div className="result-filter-bar-tabs" role="tablist" aria-label="结果分类">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={active ? 'result-filter-tab active' : 'result-filter-tab'}
              onClick={() => onTabChange(tab.key)}
            >
              {tab.label}
              <span className="result-filter-tab-line" />
            </button>
          );
        })}
      </div>

      <div className="result-filter-bar-controls">
        <div className="result-filter-segment" role="tablist" aria-label="排序方式">
          {sortOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className={activeSort === option.key ? 'result-filter-control active' : 'result-filter-control'}
              onClick={() => onSortChange(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="result-filter-divider" aria-hidden="true" />

        <div className="result-filter-price">
          <InputNumber
            min={0}
            value={minPrice ?? undefined}
            placeholder="最低价"
            controls={false}
            onChange={(value) => onMinPriceChange(typeof value === 'number' ? value : null)}
          />
          <span className="result-filter-price-separator">-</span>
          <InputNumber
            min={0}
            value={maxPrice ?? undefined}
            placeholder="最高价"
            controls={false}
            onChange={(value) => onMaxPriceChange(typeof value === 'number' ? value : null)}
          />
        </div>

        {creditOptions && activeCredit && onCreditChange ? (
          <>
            <div className="result-filter-divider" aria-hidden="true" />
            <div className="result-filter-segment" role="tablist" aria-label="信用筛选">
              {creditOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={activeCredit === option.key ? 'result-filter-control active' : 'result-filter-control'}
                  onClick={() => onCreditChange(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {trailingContent ? (
          <>
            <div className="result-filter-divider" aria-hidden="true" />
            <div className="result-filter-trailing">{trailingContent}</div>
          </>
        ) : null}
      </div>
    </div>
  );
}
