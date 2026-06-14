import { MessageOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Skeleton, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ActionRow } from '../components/layout';
import { SectionCard } from '../components/ui';
import {
  acceptCampusServiceListing,
  createConversation,
  createOrder,
  fetchCampusServiceDetail,
  fetchProductDetail,
  getApiErrorMessage,
  type CampusServiceDetailView,
  type ProductDetailView
} from '../services/api';
import { useAuthState } from '../services/auth-state';
import { hasTradingAccess, isGuestUser } from '../services/session';
import { getUserPresentation } from '../utils/userPresentation';
import { resolvePrimaryProductImage, resolveProductGallery } from '../utils/productCover';

type CheckoutMode = 'product' | 'service';

type CheckoutFormValues = {
  note?: string;
};

type CheckoutMetaItem = {
  key: string;
  label: string;
  value: string;
};

function formatDateTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function OrderCheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuthState();
  const [form] = Form.useForm<CheckoutFormValues>();
  const [product, setProduct] = useState<ProductDetailView | null>(null);
  const [service, setService] = useState<CampusServiceDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [chatSubmitting, setChatSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode = searchParams.get('type') === 'service' ? 'service' : 'product';
  const rawId = Number(searchParams.get(mode === 'service' ? 'serviceId' : 'productId'));
  const canSubmit = Number.isFinite(rawId) && rawId > 0;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setProduct(null);
      setService(null);

      if (!canSubmit) {
        setError('缺少有效的下单对象。');
        setLoading(false);
        return;
      }

      try {
        if (mode === 'service') {
          const detail = await fetchCampusServiceDetail(rawId);
          if (cancelled) {
            return;
          }
          setService(detail);
          form.setFieldsValue({
            note: detail.intent === 'REQUEST'
              ? `我来接“${detail.title}”，可按约定时间地点服务。`
              : `我想预约“${detail.title}”，请确认时间地点。`
          });
        } else {
          const detail = await fetchProductDetail(rawId);
          if (cancelled) {
            return;
          }
          setProduct(detail);
          form.setFieldsValue({
            note: `想约“${detail.title}”当面交易`
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getApiErrorMessage(loadError, '下单信息加载失败。'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [canSubmit, form, mode, rawId]);

  const summary = useMemo(() => {
    if (mode === 'service' && service) {
      const image = resolveProductGallery({
        title: service.title,
        category: service.categoryLabel,
        price: service.reward,
        imageUrl: service.imageUrl,
        images: service.images ?? service.detailBase.images,
        sellerName: service.publisher.displayName
      }, service.id, 1)[0];

      return {
        title: service.title,
        amount: service.rewardLabel,
        image,
        publisher: service.publisher,
        mainColumnLabel: '服务内容',
        columnLabel: '服务信息',
        attrItems: [
          { key: 'category', label: '分类', value: service.categoryLabel },
          { key: 'deadline', label: '时效', value: service.fulfillment.deadlineLabel },
          { key: 'fulfillment', label: '履约', value: service.fulfillment.modeLabel },
          { key: 'contact', label: '联系', value: service.contactPreferenceLabel }
        ] satisfies CheckoutMetaItem[],
        sideItems: [
          { key: 'intent', label: '订单类型', value: orderTypeLabelForMode('service') },
          { key: 'createdAt', label: '发布时间', value: formatDateTimeLabel(service.createdAt) }
        ] satisfies CheckoutMetaItem[]
      };
    }

    if (product) {
      return {
        title: product.title,
        amount: product.detailBase.amountLabel,
        image: resolvePrimaryProductImage(product),
        publisher: product.seller,
        mainColumnLabel: '商品信息',
        columnLabel: '商品属性',
        attrItems: [
          { key: 'category', label: '分类', value: product.detailBase.metaItems.find((item) => item.key === 'category')?.value ?? product.category },
          { key: 'sellerStatus', label: '卖家状态', value: product.detailBase.metaItems.find((item) => item.key === 'seller-status')?.value ?? '普通账号' }
        ] satisfies CheckoutMetaItem[],
        sideItems: [
          { key: 'orderType', label: '订单类型', value: orderTypeLabelForMode('product') },
          { key: 'publishedAt', label: '发布时间', value: formatDateTimeLabel(product.publishedAt) }
        ] satisfies CheckoutMetaItem[]
      };
    }

    return null;
  }, [mode, product, service]);

  const sellerPresentation = useMemo(
    () => (summary ? getUserPresentation(summary.publisher) : null),
    [summary]
  );
  const orderTypeLabel = mode === 'service' ? '服务订单' : '商品订单';
  const orderFlowSteps = mode === 'service'
    ? ['提交订单', service?.autoConfirm ? '进入待服务' : '等待确认', '服务完成']
    : ['提交订单', '待面交确认', '完成订单'];

  function ensureAccess() {
    if (!currentUser) {
      message.error('请先登录后再下单');
      void navigate('/login');
      return false;
    }
    if (isGuestUser(currentUser)) {
      message.error('浏览账号不可下单');
      void navigate('/login');
      return false;
    }
    if (!hasTradingAccess(currentUser)) {
      message.error('当前账号不可下单');
      return false;
    }
    return true;
  }

  async function handleSubmit(values: CheckoutFormValues) {
    if (!ensureAccess()) {
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'service') {
        if (!service) {
          throw new Error('服务信息不存在');
        }
        await acceptCampusServiceListing(service.id, {
          initialMessage: values.note?.trim() || undefined
        });
        message.success(service.autoConfirm ? '下单成功，已进入待服务' : '下单成功，等待发布者确认');
        void navigate('/profile', { state: { section: 'items', publishedScope: 'campus-services-booking' } });
        return;
      }

      if (!product) {
        throw new Error('商品信息不存在');
      }
      await createOrder({
        productId: product.id,
        note: values.note?.trim() || undefined
      });
      message.success('下单成功，订单已进入待面交');
      void navigate('/profile', { state: { section: 'orders', orderScope: 'buying' } });
    } catch (submitError) {
      message.error(getApiErrorMessage(submitError, '下单失败，请稍后重试。'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOpenChat() {
    if (!ensureAccess()) {
      return;
    }

    if (mode === 'service') {
      if (!service?.conversationId) {
        message.error('当前服务暂时没有可用会话');
        return;
      }
      void navigate(`/messages?conversationId=${service.conversationId}`);
      return;
    }

    if (!product) {
      return;
    }

    setChatSubmitting(true);
    try {
      const conversation = await createConversation({ productId: product.id });
      void navigate('/messages', {
        state: {
          conversationId: conversation.id,
          channel: 'trade'
        }
      });
    } catch (chatError) {
      message.error(getApiErrorMessage(chatError, '打开会话失败，请稍后重试。'));
    } finally {
      setChatSubmitting(false);
    }
  }

  return (
    <div className="page-grid checkout-page">
      {error ? <Alert type="error" showIcon message={error} /> : null}

      {loading ? (
        <SectionCard>
          <Skeleton active paragraph={{ rows: 8 }} />
        </SectionCard>
      ) : summary ? (
        <SectionCard className="checkout-shell-card">
          <div className="checkout-layout">
            <div className="checkout-topbar">
              <div className="checkout-topbar-copy">
                <strong>{orderTypeLabel}</strong>
              </div>
              <div className="checkout-step-strip" aria-label="订单流程">
                {orderFlowSteps.map((step, index) => (
                  <div key={step} className="checkout-step-item">
                    <i>{index + 1}</i>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="checkout-order-card">
              <div className="checkout-order-card-title">确认订单信息</div>

              <div className="checkout-order-meta-strip">
                {summary.sideItems.map((item) => (
                  <div key={item.key} className="checkout-side-item">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>

              <div className="checkout-order-header" aria-hidden="true">
                <div>{summary.mainColumnLabel}</div>
                <div>{summary.columnLabel}</div>
                <div>价格</div>
              </div>

              <div className="checkout-shop-card">
                {sellerPresentation ? (
                  <div className="checkout-shop-info" aria-label="当前卖家信息">
                    <div className="checkout-shop-copy is-inline">
                      <strong>{sellerPresentation.displayName}</strong>
                      <span>{summary.publisher.studentId ? `学号 ${summary.publisher.studentId}` : '学号未公开'}</span>
                      <Button
                        className="checkout-chat-button is-icon-only"
                        onClick={() => void handleOpenChat()}
                        loading={chatSubmitting}
                        aria-label="聊一聊"
                        icon={<MessageOutlined />}
                      />
                    </div>
                    <div className="checkout-shop-actions">
                      <div className={`ui-credit-badge is-${sellerPresentation.creditBadge.tone}`}>
                        <span className="ui-credit-badge-label">{sellerPresentation.creditBadge.label}</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="checkout-order-item">
                  <div className="checkout-item-main">
                    <img src={summary.image} alt={summary.title} />
                    <div className="checkout-item-copy">
                      <h1>{summary.title}</h1>
                    </div>
                  </div>

                  <div className="checkout-item-attrs">
                    {summary.attrItems.map((item) => (
                      <span key={item.key}>{item.label}：{item.value}</span>
                    ))}
                  </div>

                  <div className="checkout-item-price">
                    <strong>{summary.amount}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="checkout-form-pane">
              <Form form={form} layout="vertical" onFinish={(values) => void handleSubmit(values)}>
                <div className="checkout-order-ext">
                  <div className="checkout-order-ext-left">
                    <div className="checkout-order-ext-title">订单备注</div>
                    <div className="checkout-order-ext-desc">付款后对方可见，建议提前沟通一致。</div>
                    <Form.Item
                      label={null}
                      name="note"
                      className="checkout-note-field"
                    >
                      <Input.TextArea
                        rows={3}
                        maxLength={200}
                        showCount
                        placeholder="请输入，提交后对方可见"
                        className="checkout-note-textarea"
                      />
                    </Form.Item>
                  </div>
                </div>

                <ActionRow
                  leading={<Link to={mode === 'service' ? `/campus-services/${rawId}` : `/products/${rawId}`}>返回详情</Link>}
                  className="checkout-action-row"
                >
                  <Button onClick={() => navigate(-1)}>取消</Button>
                  <Button type="primary" htmlType="submit" loading={submitting}>
                    确认下单
                  </Button>
                </ActionRow>
              </Form>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

function orderTypeLabelForMode(mode: CheckoutMode) {
  return mode === 'service' ? '服务订单' : '商品订单';
}
