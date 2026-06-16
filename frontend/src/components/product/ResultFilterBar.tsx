import { Checkbox, InputNumber, Popover } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
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

export type ResultCategoryOption = {
  key: string;
  label: string;
};

type ResultFilterBarProps = {
  tabs?: ResultFilterTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  leadingContent?: ReactNode;
  categoryOptions?: ResultCategoryOption[];
  activeCategories?: string[];
  onCategoryToggle?: (key: string) => void;
  sortOptions: ResultSortOption[];
  activeSort: string;
  onSortChange: (key: string) => void;
  minPrice?: number | null;
  maxPrice?: number | null;
  onMinPriceChange: (value: number | null) => void;
  onMaxPriceChange: (value: number | null) => void;
  creditOptions?: ResultCreditOption[];
  activeCredits?: string[];
  onCreditToggle?: (key: string) => void;
  trailingContent?: ReactNode;
};

export function ResultFilterBar({
  tabs,
  activeTab,
  onTabChange,
  leadingContent,
  categoryOptions,
  activeCategories,
  onCategoryToggle,
  sortOptions,
  activeSort,
  onSortChange,
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
  creditOptions,
  activeCredits,
  onCreditToggle,
  trailingContent
}: ResultFilterBarProps) {
  const [creditOpen, setCreditOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const selectedCreditCount = activeCredits?.length ?? 0;
  const selectedCategoryCount = activeCategories?.length ?? 0;
  const creditLabel = useMemo(() => {
    if (!selectedCreditCount) {
      return '信用';
    }

    return `信用 ${selectedCreditCount}`;
  }, [selectedCreditCount]);
  const categoryLabel = useMemo(() => {
    if (!selectedCategoryCount) {
      return '分类';
    }

    return `分类 ${selectedCategoryCount}`;
  }, [selectedCategoryCount]);

  return (
    <div className="result-filter-bar">
      <div className="result-filter-leading">
        {tabs?.length ? (
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
                  onClick={() => onTabChange?.(tab.key)}
                >
                  {tab.label}
                  <span className="result-filter-tab-line" />
                </button>
              );
            })}
          </div>
        ) : null}

        {categoryOptions?.length && activeCategories && onCategoryToggle ? (
          <div role="group" aria-label="分类筛选">
            <Popover
              trigger="click"
              placement="bottomLeft"
              open={categoryOpen}
              onOpenChange={setCategoryOpen}
              content={(
                <div className="result-filter-category-popover" role="menu" aria-label="分类筛选矩阵">
                  {categoryOptions.map((option) => {
                    const active = activeCategories.includes(option.key);

                    return (
                      <label
                        key={option.key}
                        className={active ? 'result-filter-category-chip active' : 'result-filter-category-chip'}
                      >
                        <Checkbox
                          checked={active}
                          onChange={() => onCategoryToggle(option.key)}
                        >
                          {option.label}
                        </Checkbox>
                      </label>
                    );
                  })}
                </div>
              )}
            >
              <button
                type="button"
                className={selectedCategoryCount ? 'result-filter-category-trigger active' : 'result-filter-category-trigger'}
                aria-haspopup="menu"
                aria-expanded={categoryOpen}
              >
                <span className="result-filter-group-label">{categoryLabel}</span>
                <DownOutlined className={categoryOpen ? 'result-filter-credit-arrow active' : 'result-filter-credit-arrow'} />
              </button>
            </Popover>
          </div>
        ) : null}

        {leadingContent ? <div className="result-filter-leading-extra">{leadingContent}</div> : null}
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

        {creditOptions?.length && activeCredits && onCreditToggle ? (
          <>
            <div className="result-filter-divider" aria-hidden="true" />
            <div className="result-filter-trailing result-filter-credit-group" role="group" aria-label="信用筛选">
              <Popover
                trigger="click"
                placement="bottomRight"
                open={creditOpen}
                onOpenChange={setCreditOpen}
                content={(
                  <div className="result-filter-credit-popover" role="menu" aria-label="信用等级筛选">
                    {creditOptions.map((option) => {
                      const active = activeCredits.includes(option.key);

                      return (
                        <Checkbox
                          key={option.key}
                          checked={active}
                          onChange={() => onCreditToggle(option.key)}
                          className="result-filter-credit-option"
                        >
                          {option.label}
                        </Checkbox>
                      );
                    })}
                  </div>
                )}
              >
                <button
                  type="button"
                  className={selectedCreditCount ? 'result-filter-credit-trigger active' : 'result-filter-credit-trigger'}
                  aria-haspopup="menu"
                  aria-expanded={creditOpen}
                >
                  <span className="result-filter-group-label">{creditLabel}</span>
                  <DownOutlined className={creditOpen ? 'result-filter-credit-arrow active' : 'result-filter-credit-arrow'} />
                </button>
              </Popover>
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
