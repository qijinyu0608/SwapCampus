import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ActionRow, InlineMeta, PageCard, PageHeader, SectionHeader } from '../layout';
import { AdminEntityActions, AdminEntityItem, InfoList, KeyValueGrid, MetaList, StatStrip, StatusBadge, TagList } from '../data-display';
import {
  ConfirmActionModal,
  ConfirmReasonModal,
  CreditBadge,
  DetailActionFooter,
  DetailContentBody,
  DetailInfoPanel,
  DetailInfoTopSummary,
  DetailMediaGallery,
  DetailSellerStrip,
  OrderDetailDescriptionsSection,
  OrderDetailEntrySection,
  OrderDetailHeroSection,
  OrderDetailToolbarSection,
  SectionCard
} from '.';
import { UserNameWithBadge } from '../user/UserNameWithBadge';

describe('shared UI components', () => {
  it('renders layout and data display primitives', () => {
    const { container } = render(
      <MemoryRouter>
        <div>
          <ActionRow leading={<span>leading</span>} className="row-x">
            <button type="button">action</button>
          </ActionRow>
          <InlineMeta className="meta-x">meta</InlineMeta>
          <PageHeader title="收藏" subtitle="副标题" meta={<span>3 件</span>} className="header-x" />
          <SectionHeader title="区块标题" description="区块描述" aside={<button type="button">更多</button>} className="section-x" />
          <InfoList
            className="info-x"
            items={[
              { key: '1', title: '标题一', detail: '详情一' },
              { key: '2', title: '标题二' }
            ]}
          />
          <KeyValueGrid
            className="grid-x"
            columns={2}
            emphasizeValue
            items={[
              { key: 'k1', label: '学号', value: '202600001' },
              { key: 'k2', label: '学院', value: '信息学院' }
            ]}
          />
          <MetaList className="meta-list-x" items={['教材资料', '九成新', '卖家A']} />
          <StatStrip
            className="stat-x"
            columns={3}
            items={[
              { key: 'lead', value: '高数教材', label: '¥18', emphasis: 'lead' },
              { key: 'active', value: 1, label: '在售' }
            ]}
          />
          <StatusBadge tone="warning" className="status-x">待确认</StatusBadge>
          <TagList
            className="tag-x"
            compact
            items={[
              { key: 't1', label: '跑腿' },
              { key: 't2', label: '已完成', tone: 'success' }
            ]}
          />
          <AdminEntityActions wrap className="actions-x">
            <button type="button">审核</button>
          </AdminEntityActions>
          <AdminEntityItem
            title="举报单"
            meta="待处理"
            side={<button type="button">查看</button>}
            variant="report"
            className="entity-x"
          >
            <span>详情</span>
          </AdminEntityItem>
          <PageCard title="页面卡片">卡片内容</PageCard>
        </div>
      </MemoryRouter>
    );

    expect(screen.getByText('leading')).toBeInTheDocument();
    expect(screen.getByText('action')).toBeInTheDocument();
    expect(screen.getByText('meta')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '收藏' })).toBeInTheDocument();
    expect(screen.getByText('副标题')).toBeInTheDocument();
    expect(screen.getByText('3 件')).toBeInTheDocument();
    expect(screen.getByText('区块标题')).toBeInTheDocument();
    expect(screen.getByText('区块描述')).toBeInTheDocument();
    expect(screen.getByText('标题一')).toBeInTheDocument();
    expect(screen.getByText('详情一')).toBeInTheDocument();
    expect(screen.getByText('202600001')).toBeInTheDocument();
    expect(screen.getByText('教材资料')).toBeInTheDocument();
    expect(screen.getByText('高数教材')).toBeInTheDocument();
    expect(screen.getByText('待确认')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('举报单')).toBeInTheDocument();
    expect(screen.getByText('卡片内容')).toBeInTheDocument();

    expect(container.querySelector('.row-x')).toBeTruthy();
    expect(container.querySelector('.header-x')).toBeTruthy();
    expect(container.querySelector('.section-x')).toBeTruthy();
    expect(container.querySelector('.grid-x')).toHaveStyle('--key-value-columns: 2');
    expect(container.querySelector('.stat-x')).toHaveStyle('--stat-strip-columns: 3');
    expect(container.querySelector('.status-x')).toBeTruthy();
    expect(container.querySelector('.tag-x')).toBeTruthy();
    expect(container.querySelector('.actions-x')).toBeTruthy();
    expect(container.querySelector('.entity-x')).toBeTruthy();
  });

  it('renders detail and order sections and supports gallery/modal interactions', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const onReasonChange = vi.fn();
    const onEntryClick = vi.fn();
    const onSelect = vi.fn();

    render(
      <MemoryRouter>
        <div>
          <CreditBadge tone="excellent" label="信用优秀" className="credit-x" />
          <UserNameWithBadge as="strong" name="张同学" trustedBadgeUnlocked />
          <DetailContentBody
            title="高数教材"
            meta={<MetaList items={['教材资料', '九成新']} />}
            description="九成新，带笔记"
            expandButton={<button type="button">展开</button>}
          />
          <DetailInfoTopSummary
            stats={['2 人想要', '3 收藏']}
            favoriteButton={<button type="button">收藏商品</button>}
            amount={<strong>¥18.00</strong>}
          />
          <DetailActionFooter
            actions={<button type="button">立即下单</button>}
            status={<div>商品已售出</div>}
            quietAction={<button type="button">举报</button>}
          />
          <DetailInfoPanel
            className="panel-x"
            top={<div>顶部</div>}
            body={<div>主体</div>}
            footer={<div>底部</div>}
          />
          <DetailMediaGallery
            images={['/a.png', '/b.png']}
            activeIndex={0}
            onSelect={onSelect}
            title="高数教材"
            galleryKey={7}
          />
          <DetailSellerStrip
            userId={7}
            name="卖家A"
            avatarUrl={null}
            avatarFrame={null}
            trustedBadgeUnlocked
            creditTone="excellent"
            creditLabel="信用优秀"
            stats={['信息学院', '完成 5 单']}
            followButton={<button type="button">关注</button>}
          />
          <SectionCard title="说明" extra={<button type="button">操作</button>} compact className="card-x">
            内容
          </SectionCard>
          <OrderDetailHeroSection
            title="订单标题"
            statusLabel="进行中"
            statusColor="blue"
            codeLabel="订单编号"
            codeValue="ORD-18"
            counterpartName="卖家乙"
            counterpartTrusted
            amountLabel="¥18"
            imageSrc="/book.png"
            imageAlt="商品图"
          />
          <OrderDetailToolbarSection extra={<span>补充</span>}>
            <button type="button">确认收货</button>
          </OrderDetailToolbarSection>
          <OrderDetailDescriptionsSection
            title="订单信息"
            items={[
              { key: 'meeting', label: '地点', value: '图书馆' },
              { key: 'note', label: '备注', value: '晚饭后交易' }
            ]}
          />
          <OrderDetailEntrySection
            title="商品快照"
            subtitle="高数教材"
            meta="教材资料 · 九成新"
            onClick={onEntryClick}
          />
          <ConfirmActionModal
            open
            title="确认操作"
            description="确定要继续吗？"
            confirmText="确认"
            cancelText="返回"
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
          <ConfirmReasonModal
            open
            title="填写原因"
            reason="当前原因"
            reasonPlaceholder="请输入原因"
            onReasonChange={onReasonChange}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </div>
      </MemoryRouter>
    );

    expect(screen.getAllByText('信用优秀').length).toBeGreaterThan(0);
    expect(screen.getByText('张同学')).toBeInTheDocument();
    expect(screen.getAllByLabelText('守约徽章').length).toBeGreaterThan(0);
    expect(screen.getByText('九成新，带笔记')).toBeInTheDocument();
    expect(screen.getByText('2 人想要')).toBeInTheDocument();
    expect(screen.getByText('商品已售出')).toBeInTheDocument();
    expect(screen.getByText('顶部')).toBeInTheDocument();
    expect(screen.getByAltText('高数教材')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打开卖家A的主页' })).toHaveAttribute('href', '/users/7');
    expect(screen.getByText('说明')).toBeInTheDocument();
    expect(screen.getByText('订单标题')).toBeInTheDocument();
    expect(screen.getByText('订单编号：ORD-18')).toBeInTheDocument();
    expect(screen.getByText('订单信息')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /商品快照\s*高数教材\s*教材资料/ })).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(screen.getByText('确认操作')).toBeInTheDocument();
    expect(screen.getByText('填写原因')).toBeInTheDocument();
    expect(screen.getByDisplayValue('当前原因')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '高数教材-2' }));
    expect(onSelect).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('button', { name: /商品快照\s*高数教材\s*教材资料/ }));
    expect(onEntryClick).toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: /^\s*确\s*认\s*$/ })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: /^\s*返\s*回\s*$/ })[0]!);
    expect(onConfirm).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('请输入原因'), { target: { value: '新的原因' } });
    expect(onReasonChange).toHaveBeenCalledWith('新的原因');
  });
});
