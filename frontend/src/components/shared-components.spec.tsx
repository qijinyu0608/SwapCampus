import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoticePanel } from './feedback/NoticePanel';
import { ThinkingOverlay } from './feedback/ThinkingOverlay';
import { FormActionModal } from './ui/FormActionModal';
import { OrderCounterpartHeader, ProfileOrderIdentity } from './ui/OrderCounterpartHeader';
import { OrderItemSummary } from './ui/OrderItemSummary';
import { OrderPreviewCard } from './ui/OrderPreviewCard';
import { ProfileOrderScopePanel } from './ui/ProfileOrderScopePanel';
import { ReportFormModal } from './ui/ReportFormModal';
import { UserReviewCard } from './user/UserReviewCard';

vi.mock('antd', () => {
  const Modal = ({
    open,
    title,
    onOk,
    onCancel,
    okText = '确认',
    cancelText = '取消',
    width,
    className,
    confirmLoading,
    children
  }: any) => {
    if (!open) {
      return null;
    }

    return (
      <div
        role="dialog"
        className={className}
        data-width={width == null ? '' : String(width)}
        data-confirm-loading={confirmLoading ? 'true' : 'false'}
      >
        <h2>{title}</h2>
        <div>{children}</div>
        <button type="button" onClick={onOk}>{okText}</button>
        <button type="button" onClick={onCancel}>{cancelText}</button>
      </div>
    );
  };

  const Form = ({ children, className, layout, initialValues }: any) => (
    <form
      className={className}
      data-layout={layout}
      data-initial-values={JSON.stringify(initialValues)}
    >
      {children}
    </form>
  );

  Form.Item = ({ children, label, name }: any) => (
    <label data-name={name}>
      {label ? <span>{label}</span> : null}
      {children}
    </label>
  );

  const TextArea = ({ value, onChange, placeholder, rows, maxLength, showCount }: any) => (
    <textarea
      aria-label={placeholder ?? 'textarea'}
      value={value}
      readOnly={typeof onChange !== 'function'}
      rows={rows}
      maxLength={maxLength}
      data-show-count={showCount ? 'true' : 'false'}
      onChange={onChange}
    />
  );

  const Input = { TextArea };

  const Radio = ({ value, children }: any) => (
    <label>
      <input type="radio" value={value} />
      {children}
    </label>
  );

  Radio.Group = ({ children, className }: any) => (
    <div className={className}>
      {children}
    </div>
  );

  const Select = ({ options = [] }: any) => (
    <select aria-label="举报类型">
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );

  const Spin = ({ size }: any) => <div data-testid="spin" data-size={size} />;

  return {
    Modal,
    Form,
    Input,
    Radio,
    Select,
    Spin
  };
});

describe('shared low-coverage components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders notice panels with optional description, actions and tone', () => {
    const { container, rerender } = render(
      <NoticePanel title="风险提示" description="请先核实信息" tone="danger" className="notice-x">
        <button type="button">去处理</button>
      </NoticePanel>
    );

    expect(screen.getByText('风险提示')).toBeInTheDocument();
    expect(screen.getByText('请先核实信息')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '去处理' })).toBeInTheDocument();
    expect(container.querySelector('.ui-notice-panel.is-danger.notice-x')).toBeTruthy();
    expect(container.querySelector('.ui-notice-actions')).toBeTruthy();

    rerender(<NoticePanel title="普通提示" />);

    expect(screen.getByText('普通提示')).toBeInTheDocument();
    expect(container.querySelector('.is-danger')).toBeFalsy();
    expect(container.querySelector('.ui-notice-actions')).toBeFalsy();
  });

  it('renders the thinking overlay only when open and uses default copy', () => {
    const { rerender } = render(<ThinkingOverlay open />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
    expect(screen.getByText('正在进行 AI 审核与 AI 分类，请稍候。')).toBeInTheDocument();
    expect(screen.getByTestId('spin')).toHaveAttribute('data-size', 'large');

    rerender(<ThinkingOverlay open={false} />);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders form action modals with default and custom actions', () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <FormActionModal title="编辑资料" open onCancel={onCancel} onSubmit={onSubmit}>
        <div>表单内容</div>
      </FormActionModal>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('编辑资料')).toBeInTheDocument();
    expect(screen.getByText('表单内容')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '确认' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(
      <FormActionModal
        title="编辑资料"
        open
        loading
        width={640}
        className="modal-x"
        okText="保存"
        cancelText="关闭"
        onCancel={onCancel}
        onSubmit={onSubmit}
      >
        <div>表单内容</div>
      </FormActionModal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('modal-x');
    expect(dialog).toHaveAttribute('data-width', '640');
    expect(dialog).toHaveAttribute('data-confirm-loading', 'true');
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
  });

  it('renders report form modals with the expected initial identity mode', () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    const form = {} as any;
    const { container, rerender } = render(
      <ReportFormModal
        open
        loading
        typeOptions={['违规商品', '虚假宣传']}
        realNameAvailable
        form={form}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );

    const reportForm = container.querySelector('.detail-report-form');
    expect(reportForm).toHaveAttribute('data-layout', 'vertical');
    expect(JSON.parse(reportForm?.getAttribute('data-initial-values') ?? '{}')).toEqual({
      type: '违规商品',
      identityMode: 'REAL_NAME',
      contactConsent: 'YES'
    });
    expect(screen.getByRole('heading', { name: '提交举报' })).toBeInTheDocument();
    expect(screen.getByText('举报方式')).toBeInTheDocument();
    expect(screen.getByText('实名举报')).toBeInTheDocument();
    expect(screen.getByText('匿名展示')).toBeInTheDocument();
    expect(screen.getByText('愿意配合管理员补充材料')).toBeInTheDocument();
    expect(screen.getByText('仅提交当前信息')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '违规商品' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '虚假宣传' })).toBeInTheDocument();
    expect(screen.getByLabelText('请描述问题、聊天经过、交易时间或可核查线索')).toHaveAttribute('rows', '5');

    fireEvent.click(screen.getByRole('button', { name: '提交举报' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(
      <ReportFormModal
        open
        typeOptions={['违规商品', '虚假宣传']}
        realNameAvailable={false}
        form={form}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );

    expect(JSON.parse(container.querySelector('.detail-report-form')?.getAttribute('data-initial-values') ?? '{}')).toEqual({
      type: '违规商品',
      identityMode: 'ANONYMOUS',
      contactConsent: 'YES'
    });
  });

  it('renders order counterpart identity blocks and credit actions', () => {
    const { container } = render(
      <div>
        <ProfileOrderIdentity
          avatarSrc="/avatar.png"
          avatarAlt="买家甲头像"
          fallbackLabel="买"
          avatarFrame="gold-ring"
          name="买家甲"
          statusTag={<span>已实名</span>}
        />
        <OrderCounterpartHeader
          copyContent={<span>订单联系人</span>}
          creditTone="excellent"
          creditLabel="信用优秀"
          conversationButton={<button type="button">发消息</button>}
        />
      </div>
    );

    expect(screen.getByAltText('买家甲头像')).toBeInTheDocument();
    expect(screen.getByText('买家甲')).toBeInTheDocument();
    expect(screen.getByText('已实名')).toBeInTheDocument();
    expect(screen.getByLabelText('订单对象信息')).toBeInTheDocument();
    expect(screen.getByText('订单联系人')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发消息' })).toBeInTheDocument();
    expect(screen.getByText('信用优秀')).toBeInTheDocument();
    expect(container.querySelector('.checkout-shop-copy.is-inline')).toBeTruthy();
    expect(container.querySelector('.checkout-shop-actions')).toBeTruthy();
  });

  it('renders order item summaries and preview cards in both wrapper modes', () => {
    const { container } = render(
      <div>
        <OrderItemSummary
          imageSrc="/book.png"
          imageAlt="教材图"
          title="高数教材"
          subtitle={<span>九成新</span>}
          attrs={<span>教材资料</span>}
          amount={<strong>¥18</strong>}
          actions={<button type="button">去下单</button>}
          className="summary-x"
          copyClassName="copy-x"
          attrsClassName="attrs-x"
          amountClassName="amount-x"
          actionsClassName="actions-x"
          titleAs="h4"
        />
        <OrderPreviewCard
          articleClassName="article-x"
          cardClassName="card-x"
          headerProps={{
            copyContent: <span>卖家乙</span>,
            creditTone: 'good',
            creditLabel: '信用良好',
            conversationButton: <button type="button">联系卖家</button>
          }}
          beforeSummary={<div>售前说明</div>}
          summaryProps={{
            imageSrc: '/service.png',
            imageAlt: '服务图',
            title: '代取快递',
            attrs: <span>跑腿代办</span>,
            amount: <strong>¥8</strong>
          }}
          afterSummary={<div>售后说明</div>}
        />
        <OrderPreviewCard
          summaryProps={{
            imageSrc: '/raw.png',
            imageAlt: '原始图',
            title: '无包装订单',
            attrs: <span>现场交易</span>,
            amount: <strong>¥12</strong>
          }}
        />
      </div>
    );

    expect(screen.getByAltText('教材图')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '高数教材' })).toBeInTheDocument();
    expect(screen.getByText('教材资料')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '去下单' })).toBeInTheDocument();
    expect(container.querySelector('.checkout-order-item.summary-x')).toBeTruthy();
    expect(container.querySelector('.copy-x')).toBeTruthy();
    expect(container.querySelector('.attrs-x')).toBeTruthy();
    expect(container.querySelector('.amount-x')).toBeTruthy();
    expect(container.querySelector('.actions-x')).toBeTruthy();

    expect(screen.getByText('卖家乙')).toBeInTheDocument();
    expect(screen.getByText('信用良好')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '联系卖家' })).toBeInTheDocument();
    expect(screen.getByText('售前说明')).toBeInTheDocument();
    expect(screen.getByText('售后说明')).toBeInTheDocument();
    expect(screen.getByAltText('服务图')).toBeInTheDocument();
    expect(container.querySelector('.article-x .checkout-shop-card.card-x')).toBeTruthy();
    expect(screen.getByAltText('原始图')).toBeInTheDocument();
    expect(screen.getByText('无包装订单')).toBeInTheDocument();
  });

  it('renders profile order scope tabs and emits the selected scope', () => {
    const onScopeChange = vi.fn();

    render(
      <ProfileOrderScopePanel
        title="商品订单"
        scope="active"
        onScopeChange={onScopeChange}
        scopeCounts={{ active: 3, ended: 7 }}
      >
        <div>订单列表</div>
      </ProfileOrderScopePanel>
    );

    expect(screen.getByRole('tablist', { name: '商品订单进度筛选' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进行中 (3)' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: '已结束 (7)' })).not.toHaveClass('active');
    expect(screen.getByText('订单列表')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '已结束 (7)' }));
    fireEvent.click(screen.getByRole('button', { name: '进行中 (3)' }));

    expect(onScopeChange).toHaveBeenNthCalledWith(1, 'ended');
    expect(onScopeChange).toHaveBeenNthCalledWith(2, 'active');
  });

  it('renders user review cards using composite scores when available', () => {
    const { rerender } = render(
      <UserReviewCard
        reviewerName="张同学"
        createdAt="2026-06-16T10:00:00.000Z"
        rating={1}
        content="服务很好，综合评分: 4.3，值得再次合作。"
        reviewerTrustedBadgeUnlocked
      />
    );

    expect(screen.getByText('张同学')).toBeInTheDocument();
    expect(screen.getByLabelText('守约徽章')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '评分 4.5 / 5' })).toBeInTheDocument();
    expect(screen.getByText('服务很好，综合评分: 4.3，值得再次合作。')).toBeInTheDocument();

    rerender(
      <UserReviewCard
        reviewerName="李同学"
        createdAt="2026-06-17T10:00:00.000Z"
        rating={3.7}
        content="沟通顺畅，按时完成。"
      />
    );

    expect(screen.getByText('李同学')).toBeInTheDocument();
    expect(screen.queryByLabelText('守约徽章')).toBeNull();
    expect(screen.getByRole('img', { name: '评分 3.5 / 5' })).toBeInTheDocument();
    expect(screen.getByText('沟通顺畅，按时完成。')).toBeInTheDocument();
  });
});
