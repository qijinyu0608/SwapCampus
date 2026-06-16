import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResultFilterBar } from './ResultFilterBar';

vi.mock('antd', () => ({
  Checkbox: ({ checked, onChange, children, className }: any) => (
    <label className={className}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange?.({ target: { checked: !checked } })}
      />
      <span>{children}</span>
    </label>
  ),
  InputNumber: ({ value, placeholder, onChange }: any) => (
    <input
      aria-label={placeholder}
      value={value ?? ''}
      onChange={(event) => {
        const next = event.target.value;
        onChange?.(next === '' ? null : Number(next));
      }}
    />
  ),
  Popover: ({ content, children, open = false, onOpenChange }: any) => (
    <div>
      <div onClick={() => onOpenChange?.(!open)}>
        {children}
      </div>
      {open ? <div>{content}</div> : null}
    </div>
  )
}));

vi.mock('@ant-design/icons', () => ({
  DownOutlined: ({ className }: any) => <span data-testid="down-icon" className={className}>v</span>
}));

describe('ResultFilterBar', () => {
  const handlers = {
    onTabChange: vi.fn(),
    onCategoryToggle: vi.fn(),
    onSortChange: vi.fn(),
    onMinPriceChange: vi.fn(),
    onMaxPriceChange: vi.fn(),
    onCreditToggle: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders tabs and core controls, then forwards tab and sort changes', async () => {
    const user = userEvent.setup();

    render(
      <ResultFilterBar
        tabs={[
          { key: 'all', label: '全部' },
          { key: 'request', label: '求助' }
        ]}
        activeTab="all"
        onTabChange={handlers.onTabChange}
        sortOptions={[
          { key: 'composite', label: '综合' },
          { key: 'price_desc', label: '价格高到低' }
        ]}
        activeSort="composite"
        onSortChange={handlers.onSortChange}
        onMinPriceChange={handlers.onMinPriceChange}
        onMaxPriceChange={handlers.onMaxPriceChange}
      />
    );

    expect(screen.getByRole('tab', { name: '全部' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: '综合' })).toBeInTheDocument();
    expect(screen.getByLabelText('最低价')).toBeInTheDocument();
    expect(screen.getByLabelText('最高价')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '求助' }));
    expect(handlers.onTabChange).toHaveBeenCalledWith('request');

    await user.click(screen.getByRole('button', { name: '价格高到低' }));
    expect(handlers.onSortChange).toHaveBeenCalledWith('price_desc');
  });

  it('shows selected category and credit counts and toggles both popovers', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <ResultFilterBar
        categoryOptions={[
          { key: 'ERRAND', label: '跑腿代办' },
          { key: 'GROUP_BUY', label: '拼单' }
        ]}
        activeCategories={[]}
        onCategoryToggle={handlers.onCategoryToggle}
        sortOptions={[{ key: 'composite', label: '综合' }]}
        activeSort="composite"
        onSortChange={handlers.onSortChange}
        onMinPriceChange={handlers.onMinPriceChange}
        onMaxPriceChange={handlers.onMaxPriceChange}
        creditOptions={[
          { key: 'EXCELLENT', label: '优秀' },
          { key: 'NORMAL', label: '普通' }
        ]}
        activeCredits={[]}
        onCreditToggle={handlers.onCreditToggle}
      />
    );

    expect(screen.getByRole('button', { name: /分类/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /信用/ })).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('button', { name: /分类/ }));
    expect(screen.getByRole('menu', { name: '分类筛选矩阵' })).toBeInTheDocument();
    await user.click(screen.getByText('跑腿代办'));
    expect(handlers.onCategoryToggle).toHaveBeenCalledWith('ERRAND');

    await user.click(screen.getByRole('button', { name: /信用/ }));
    expect(screen.getByRole('menu', { name: '信用等级筛选' })).toBeInTheDocument();
    await user.click(screen.getByText('优秀'));
    expect(handlers.onCreditToggle).toHaveBeenCalledWith('EXCELLENT');

    rerender(
      <ResultFilterBar
        categoryOptions={[
          { key: 'ERRAND', label: '跑腿代办' },
          { key: 'GROUP_BUY', label: '拼单' }
        ]}
        activeCategories={['ERRAND', 'GROUP_BUY']}
        onCategoryToggle={handlers.onCategoryToggle}
        sortOptions={[{ key: 'composite', label: '综合' }]}
        activeSort="composite"
        onSortChange={handlers.onSortChange}
        onMinPriceChange={handlers.onMinPriceChange}
        onMaxPriceChange={handlers.onMaxPriceChange}
        creditOptions={[
          { key: 'EXCELLENT', label: '优秀' },
          { key: 'NORMAL', label: '普通' }
        ]}
        activeCredits={['EXCELLENT']}
        onCreditToggle={handlers.onCreditToggle}
      />
    );

    expect(screen.getByRole('button', { name: /分类 2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /信用 1/ })).toBeInTheDocument();
  });

  it('forwards min and max price changes and renders leading and trailing content', async () => {
    const user = userEvent.setup();

    render(
      <ResultFilterBar
        sortOptions={[{ key: 'composite', label: '综合' }]}
        activeSort="composite"
        onSortChange={handlers.onSortChange}
        minPrice={6}
        maxPrice={20}
        onMinPriceChange={handlers.onMinPriceChange}
        onMaxPriceChange={handlers.onMaxPriceChange}
        leadingContent={<span>方向切换</span>}
        trailingContent={<button type="button">额外操作</button>}
      />
    );

    expect(screen.getByText('方向切换')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '额外操作' })).toBeInTheDocument();

    await user.clear(screen.getByLabelText('最低价'));
    expect(handlers.onMinPriceChange).toHaveBeenCalledWith(null);

    await user.clear(screen.getByLabelText('最高价'));
    expect(handlers.onMaxPriceChange).toHaveBeenCalledWith(null);

    fireEvent.change(screen.getByLabelText('最低价'), { target: { value: '12' } });
    expect(handlers.onMinPriceChange).toHaveBeenLastCalledWith(12);

    fireEvent.change(screen.getByLabelText('最高价'), { target: { value: '34' } });
    expect(handlers.onMaxPriceChange).toHaveBeenLastCalledWith(34);
  });
});
