import { Alert, Button, Descriptions, Empty, Form, Input, Modal, Rate, Select, Skeleton, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SectionHeader } from '../components/layout';
import {
  FormActionModal,
  OrderDetailDescriptionsSection,
  OrderDetailEntrySection,
  OrderDetailHeroSection,
  OrderDetailToolbarSection,
  SectionCard
} from '../components/ui';
import { UserReviewCard } from '../components/user/UserReviewCard';
import { UserNameWithBadge } from '../components/user/UserNameWithBadge';
import {
  completeOrderMeetup,
  createOrderAppeal,
  createOrderReview,
  fetchOrderDetail,
  getApiErrorMessage,
  type OrderDetail
} from '../services/api';
import { useAuthState } from '../services/auth-state';
import { formatProductOrderStatus, getProductOrderStatusColor } from '../utils/orderStatus';

const reviewDimensionOptions = [
  { key: 'descriptionMatch', label: '描述相符', hint: '实物与描述、图片是否一致' },
  { key: 'communication', label: '沟通体验', hint: '回复效率、态度和协商过程' },
  { key: 'delivery', label: '交付体验', hint: '面交过程、守时情况和配合度' }
] as const;

type ReviewDimensionKey = (typeof reviewDimensionOptions)[number]['key'];
type ReviewFormValues = Record<ReviewDimensionKey, number> & {
  content?: string;
};

type AppealFormValues = {
  issueType: string;
  reason: string;
  expectedAction?: string;
};

const appealTypeOptions = [
  '未按约定交付',
  '商品/实物与描述不符',
  '恶意爽约',
  '交易态度恶劣',
  '费用争议',
  '其他问题'
];

function formatCountdown(seconds: number) {
  if (seconds <= 0) {
    return '即将自动确认收货';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainSeconds = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`;
}

function getReviewAverageLabel(score: number | null) {
  if (score === null) {
    return '完成评分后自动生成';
  }
  if (score >= 4.5) {
    return '体验很好';
  }
  if (score >= 4) {
    return '体验不错';
  }
  if (score >= 3) {
    return '整体正常';
  }
  return '有待改进';
}

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuthState();
  const [form] = Form.useForm<ReviewFormValues>();
  const [appealForm] = Form.useForm<AppealFormValues>();
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [appealOpen, setAppealOpen] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const watchedReviewValues = Form.useWatch([], form);

  const orderId = Number(id);

  async function load() {
    if (!Number.isFinite(orderId) || orderId <= 0) {
      setError('缺少有效订单编号。');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchOrderDetail(orderId);
      setDetail(result);
      setCountdown(result.autoConfirmCountdownSeconds ?? 0);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, '订单详情加载失败。'));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [orderId]);

  useEffect(() => {
    if (!detail || countdown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCountdown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [detail, countdown]);

  const isBuyer = detail?.buyerId === currentUser?.id;
  const reviewAverageScore = useMemo(() => {
    const values = watchedReviewValues as Partial<ReviewFormValues> | undefined;
    if (!values) {
      return null;
    }

    const scores = reviewDimensionOptions
      .map((item) => values[item.key])
      .filter((value): value is number => typeof value === 'number');

    if (!scores.length) {
      return null;
    }

    return Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2));
  }, [watchedReviewValues]);
  const counterpart = useMemo(() => {
    if (!detail) {
      return null;
    }
    return isBuyer
      ? {
          name: detail.sellerName,
          trustedBadgeUnlocked: Boolean((detail as OrderDetail & { sellerTrustedBadgeUnlocked?: boolean }).sellerTrustedBadgeUnlocked)
        }
      : {
          name: detail.buyerName,
          trustedBadgeUnlocked: Boolean((detail as OrderDetail & { buyerTrustedBadgeUnlocked?: boolean }).buyerTrustedBadgeUnlocked)
        };
  }, [detail, isBuyer]);

  async function handleComplete() {
    if (!detail) {
      return;
    }

    setActing(true);
    try {
      await completeOrderMeetup(detail.id);
      message.success('已确认收货，订单进入待评价');
      await load();
    } catch (actionError) {
      message.error(getApiErrorMessage(actionError, '确认收货失败。'));
    } finally {
      setActing(false);
    }
  }

  async function handleReviewSubmit(values: ReviewFormValues) {
    if (!detail) {
      return;
    }

    const dimensionScores = reviewDimensionOptions.map((item) => ({
      label: item.label,
      value: values[item.key]
    }));
    const averageScore = Number(
      (dimensionScores.reduce((sum, item) => sum + item.value, 0) / dimensionScores.length).toFixed(2)
    );
    const finalRating = Math.max(1, Math.min(5, Math.round(averageScore)));
    const reviewLines = dimensionScores.map((item) => `${item.label}：${item.value} 星`);
    const appendedContent = values.content?.trim()
      ? `${values.content.trim()}\n\n${reviewLines.join('\n')}\n综合评分：${averageScore.toFixed(2)} 分`
      : `${reviewLines.join('\n')}\n综合评分：${averageScore.toFixed(2)} 分`;

    setActing(true);
    try {
      await createOrderReview(detail.id, {
        rating: finalRating,
        content: appendedContent
      });
      message.success('评价已提交');
      setReviewOpen(false);
      form.resetFields();
      await load();
    } catch (actionError) {
      message.error(getApiErrorMessage(actionError, '提交评价失败。'));
    } finally {
      setActing(false);
    }
  }

  async function handleAppealSubmit(values: AppealFormValues) {
    if (!detail) {
      return;
    }

    setActing(true);
    try {
      await createOrderAppeal(detail.id, {
        issueType: values.issueType,
        reason: values.reason,
        expectedAction: values.expectedAction
      });
      message.success('申诉已提交');
      setAppealOpen(false);
      appealForm.resetFields();
      await load();
    } catch (actionError) {
      message.error(getApiErrorMessage(actionError, '申诉提交失败。'));
    } finally {
      setActing(false);
    }
  }

  function handleAppeal() {
    appealForm.setFieldsValue({
      issueType: appealTypeOptions[0],
      reason: '',
      expectedAction: ''
    });
    setAppealOpen(true);
  }

  function openSnapshot() {
    if (!detail) {
      return;
    }

    void navigate(`/orders/${detail.id}/snapshot`);
  }

  return (
    <div className="page-grid order-detail-page">
      <SectionHeader title="订单详情" className="is-prominent is-spacious" />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {loading ? (
        <SectionCard>
          <Skeleton active paragraph={{ rows: 10 }} />
        </SectionCard>
      ) : !detail ? (
        <SectionCard>
          <Empty description="未找到订单信息" />
        </SectionCard>
      ) : (
        <>
          <OrderDetailHeroSection
            title={detail.orderSnapshot.title}
            statusLabel={formatProductOrderStatus(detail.status)}
            statusColor={getProductOrderStatusColor(detail.status)}
            codeLabel="订单编号"
            codeValue={detail.orderCode}
            counterpartName={counterpart?.name ?? '交易对象'}
            counterpartTrusted={counterpart?.trustedBadgeUnlocked}
            amountLabel={`¥${detail.orderSnapshot.price.toFixed(2)}`}
            imageSrc={detail.orderSnapshot.imageUrl ?? detail.productImageUrl ?? ''}
            imageAlt={detail.orderSnapshot.title}
          />

          <OrderDetailToolbarSection
            extra={
              (detail.status === 'PENDING' || detail.status === 'IN_PROGRESS') && isBuyer ? (
                <div className="order-detail-countdown">
                  <span>自动确认收货倒计时</span>
                  <strong>{formatCountdown(countdown)}</strong>
                </div>
              ) : null
            }
          >
            {detail.actionState.canComplete ? (
              <Button type="primary" loading={acting} onClick={() => void handleComplete()}>
                确认收货
              </Button>
            ) : null}
            {detail.actionState.canReview ? (
              <Button onClick={() => setReviewOpen(true)}>
                评价订单
              </Button>
            ) : null}
            {detail.actionState.canAppeal ? (
              <Button onClick={handleAppeal}>
                申诉
              </Button>
            ) : null}
          </OrderDetailToolbarSection>

          <OrderDetailDescriptionsSection
            title="订单信息"
            items={[
              { key: 'created', label: '下单时间', value: detail.timeline[0]?.value ?? '待更新' },
              { key: 'autoConfirm', label: '自动确认时间', value: detail.timeline[1]?.value ?? '待更新' },
              { key: 'meetup', label: '交付方式', value: detail.meetupLocation || '待协商' },
              { key: 'payment', label: '支付方式', value: detail.paymentIntent || '线下面交后付款' },
              { key: 'note', label: '备注', value: detail.note || '无' }
            ]}
          />

          <OrderDetailEntrySection
            title="商品快照"
            subtitle={detail.orderSnapshot.title}
            meta={`${detail.orderSnapshot.category} · ${detail.orderSnapshot.condition}`}
            onClick={openSnapshot}
          />

          <SectionCard className="order-detail-panel">
            <div className="order-detail-review-head">
              <strong>订单评价</strong>
            </div>
            {detail.reviews.length ? (
              <div className="order-detail-review-list">
                {detail.reviews.map((review) => (
                  <UserReviewCard
                    key={review.id}
                    reviewerName={review.reviewerName}
                    createdAt={review.createdAt}
                    rating={review.rating}
                    content={review.content}
                  />
                ))}
              </div>
            ) : (
              <Empty description="暂无评价" />
            )}
          </SectionCard>
        </>
      )}

      <FormActionModal
        title="评价订单"
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        onSubmit={() => void form.submit()}
        loading={acting}
        okText="提交评价"
        cancelText="暂不评价"
        width={720}
        className="order-review-modal"
      >
        <Form form={form} layout="vertical" onFinish={(values) => void handleReviewSubmit(values)}>
          <div className="order-review-intro">
            <div className="order-review-intro-copy">
              <strong>完成评价后将同步到对方的个人主页</strong>
              <span>请根据本次线下交易体验分别评分，系统会自动计算综合总分。</span>
            </div>
            {detail ? (
              <div className="order-review-subject">
                <span>{detail.orderSnapshot.title}</span>
                <em>{counterpart?.name ?? '交易对象'}</em>
              </div>
            ) : null}
          </div>
          <div className="order-review-dimension-list">
            {reviewDimensionOptions.map((item) => (
              <div key={item.key} className="order-review-dimension-card">
                <div className="order-review-dimension-head">
                  <div className="order-review-dimension-copy">
                    <strong>{item.label}</strong>
                    <span>{item.hint}</span>
                  </div>
                  <em>1-5 星</em>
                </div>
                <Form.Item name={item.key} rules={[{ required: true, message: `请选择${item.label}` }]}>
                  <Rate />
                </Form.Item>
              </div>
            ))}
          </div>
          <div className="order-review-summary">
            <div className="order-review-summary-copy">
              <span>综合总分</span>
              <em>{getReviewAverageLabel(reviewAverageScore)}</em>
            </div>
            <div className="order-review-summary-score">
              <strong>{reviewAverageScore === null ? '--' : reviewAverageScore.toFixed(2)}</strong>
              <span>/ 5</span>
            </div>
          </div>
          <Form.Item name="content" label="补充评价">
            <Input.TextArea rows={5} maxLength={200} placeholder="可以补充描述交易过程、面交体验或其他细节" />
          </Form.Item>
        </Form>
      </FormActionModal>

      <FormActionModal
        title="提交申诉"
        open={appealOpen}
        onCancel={() => setAppealOpen(false)}
        onSubmit={() => void appealForm.submit()}
        loading={acting}
        okText="提交申诉"
        cancelText="取消"
        width={640}
      >
        <Form form={appealForm} layout="vertical" onFinish={(values) => void handleAppealSubmit(values)}>
          <Form.Item name="issueType" label="问题类型" rules={[{ required: true, message: '请选择问题类型' }]}>
            <Select options={appealTypeOptions.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item name="expectedAction" label="希望平台处理方式">
            <Input placeholder="例如：取消订单、要求对方说明、平台介入核查" maxLength={80} />
          </Form.Item>
          <Form.Item
            name="reason"
            label="问题说明"
            rules={[
              { required: true, message: '请填写问题说明' },
              { min: 8, message: '请至少填写 8 个字' }
            ]}
          >
            <Input.TextArea rows={5} maxLength={500} placeholder="请说明争议经过、对方行为和你希望平台介入的原因" />
          </Form.Item>
        </Form>
      </FormActionModal>
    </div>
  );
}
