import { cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ProductPublishRulesPage } from './ProductPublishRulesPage';

const mocks = vi.hoisted(() => ({
  fetchPublishingRules: vi.fn()
}));

vi.mock('../services/api', () => ({
  fetchPublishingRules: () => mocks.fetchPublishingRules()
}));

describe('ProductPublishRulesPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders fetched publishing rules and back link', async () => {
    mocks.fetchPublishingRules.mockResolvedValue({
      allowedCategories: ['教材资料'],
      prohibitedKeywords: ['账号'],
      dormElectricalWhitelist: ['电脑'],
      communityNotices: ['请在校内公共区域交易'],
      ruleHighlights: ['商品提交后直接上架展示'],
      reviewFlow: ['实名认证', '填写商品信息'],
      trustSignals: ['实名认证']
    });

    render(
      <MemoryRouter>
        <ProductPublishRulesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('SwapCampus 发布规则')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回发布页' })).toHaveAttribute('href', '/publish');
    expect(screen.getByLabelText('发布规则')).toBeInTheDocument();
    expect(screen.getByText(/教材资料/)).toBeInTheDocument();
    expect(screen.getByText(/当前重点识别的禁售或高风险关键词示例如下：账号/)).toBeInTheDocument();
    expect(screen.getByText(/电脑/)).toBeInTheDocument();
  });

  it('falls back to default rules when fetch fails', async () => {
    mocks.fetchPublishingRules.mockRejectedValueOnce(new Error('boom'));

    render(
      <MemoryRouter>
        <ProductPublishRulesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('SwapCampus 发布规则')).toBeInTheDocument();
    expect(screen.getByText(/当前允许发布的商品分类如下/)).toBeInTheDocument();
    expect(screen.getByText(/宿舍电器仅限以下白名单物品可以发布/)).toBeInTheDocument();
    expect(screen.getByText(/服务发布链路为/)).toBeInTheDocument();
  });
});
