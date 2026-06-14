import { Alert, Button, Descriptions, Empty, Form, Input, Modal, Rate, Skeleton, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SectionHeader } from '../components/layout';
import { SectionCard } from '../components/ui';
import {
  completeOrderMeetup,
  createOrderReview,
  fetchOrderDetail,
  getApiErrorMessage,
  type OrderDetail
} from '../services/api';
import { useAuthState } from '../services/auth-state';

function formatStatus(status: string) {
  if (status === 'PENDING') {
    return '待协商';
  }
  if (status === 'IN_PROGRESS') {
    return '待收货';
  }
  if (status === 'WAITING_REVIEW') {
    return '待评价';
  }
  if (status === 'COMPLETED') {
    return '已完成';
  }
  if (status === 'CANCELED') {
    return '已取消';
  }
  return status;
}

function getStatusColor(status: string) {
  if (status === 'COMPLETED') {
    return 'green';
  }
  if (status === 'WAITING_REVIEW') {
    return 'gold';
  }
  if (status === 'CANCELED') {
    return 'default';
  }
  return 'orange';
}

function formatCountdown(seconds: number) {
  if (seconds <= 0) {
    return '即将自动确认收货';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainSeconds = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`;
}

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuthState();
  const [form] = Form.useForm<{ rating: number; content?: string }>();
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [countdown, setCountdown] = useState(0);

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
  const counterpartName = useMemo(() => {
    if (!detail) {
      return '';
    }
    return isBuyer ? detail.sellerName : detail.buyerName;
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

  async function handleReviewSubmit(values: { rating: number; content?: string }) {
    if (!detail) {
      return;
    }

    setActing(true);
    try {
      await createOrderReview(detail.id, values);
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

  function handleAppeal() {
    message.info('申诉入口预留中，后续补充。');
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
          <SectionCard className="order-detail-hero-card">
            <div className="order-detail-hero">
              <div className="order-detail-hero-copy">
                <div className="order-detail-hero-top">
                  <strong>{detail.orderSnapshot.title}</strong>
                  <Tag color={getStatusColor(detail.status)}>{formatStatus(detail.status)}</Tag>
                </div>
                <span>订单编号：{detail.orderCode}</span>
                <span>下单对象：{counterpartName}</span>
                <b>¥{detail.orderSnapshot.price.toFixed(2)}</b>
              </div>
              <img
                src={detail.orderSnapshot.imageUrl ?? detail.productImageUrl ?? ''}
                alt={detail.orderSnapshot.title}
                className="order-detail-hero-image"
              />
            </div>
          </SectionCard>

          <SectionCard className="order-detail-panel">
            <div className="order-detail-toolbar">
              {detail.actionState.canOpenConversation && detail.conversationId ? (
                <Button onClick={() => navigate(`/messages?conversationId=${detail.conversationId}`)}>
                  查看订单会话
                </Button>
              ) : null}
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
            </div>
            {(detail.status === 'PENDING' || detail.status === 'IN_PROGRESS') && isBuyer ? (
              <div className="order-detail-countdown">
                <span>自动确认收货倒计时</span>
                <strong>{formatCountdown(countdown)}</strong>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard className="order-detail-panel">
            <Descriptions title="订单信息" column={1} size="small">
              <Descriptions.Item label="下单时间">{detail.timeline[0]?.value ?? '待更新'}</Descriptions.Item>
              <Descriptions.Item label="自动确认时间">{detail.timeline[1]?.value ?? '待更新'}</Descriptions.Item>
              <Descriptions.Item label="交付方式">{detail.meetupLocation || '待协商'}</Descriptions.Item>
              <Descriptions.Item label="支付方式">{detail.paymentIntent || '线下面交后付款'}</Descriptions.Item>
              <Descriptions.Item label="备注">{detail.note || '无'}</Descriptions.Item>
            </Descriptions>
          </SectionCard>

          <SectionCard className="order-detail-panel">
            <Descriptions title="商品快照" column={1} size="small">
              <Descriptions.Item label="商品名称">{detail.orderSnapshot.title}</Descriptions.Item>
              <Descriptions.Item label="分类">{detail.orderSnapshot.category}</Descriptions.Item>
              <Descriptions.Item label="成色">{detail.orderSnapshot.condition}</Descriptions.Item>
              <Descriptions.Item label="描述">{detail.orderSnapshot.description}</Descriptions.Item>
            </Descriptions>
          </SectionCard>

          <SectionCard className="order-detail-panel">
            <div className="order-detail-review-head">
              <strong>评价记录</strong>
            </div>
            {detail.reviews.length ? (
              <div className="order-detail-review-list">
                {detail.reviews.map((review) => (
                  <article key={review.id} className="order-detail-review-card">
                    <div className="order-detail-review-top">
                      <strong>{review.reviewerName}</strong>
                      <span>{new Date(review.createdAt).toLocaleString()}</span>
                    </div>
                    <Rate disabled value={review.rating} />
                    <p>{review.content}</p>
                  </article>
                ))}
              </div>
            ) : (
              <Empty description="暂无评价" />
            )}
          </SectionCard>
        </>
      )}

      <Modal
        title="评价订单"
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        onOk={() => void form.submit()}
        confirmLoading={acting}
      >
        <Form form={form} layout="vertical" onFinish={(values) => void handleReviewSubmit(values)}>
          <Form.Item name="rating" label="评分" rules={[{ required: true, message: '请选择评分' }]}>
            <Rate />
          </Form.Item>
          <Form.Item name="content" label="评价内容">
            <Input.TextArea rows={4} maxLength={200} placeholder="说说本次交易体验" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
