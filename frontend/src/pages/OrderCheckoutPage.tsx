import { CalendarOutlined, EnvironmentOutlined, PayCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Radio, Skeleton, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserAvatar } from '../components/user/UserAvatar';
import { ActionRow, SectionHeader } from '../components/layout';
import { SectionCard } from '../components/ui';
import {
  acceptCampusServiceListing,
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
  location?: string;
  time: string;
  note?: string;
  paymentIntent: string;
  deliveryMode?: 'offline_meetup' | 'locker_dropoff';
};

function getDefaultTimeLabel() {
  const date = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

function buildServiceFallbackLocation(detail: CampusServiceDetailView) {
  if (detail.fulfillment.routeLabel && detail.fulfillment.routeLabel !== '待协商') {
    return detail.fulfillment.routeLabel;
  }
  if (detail.locationFrom && detail.locationTo && detail.locationFrom !== detail.locationTo) {
    return `${detail.locationFrom} -> ${detail.locationTo}`;
  }
  return detail.locationFrom || detail.locationTo || '校内地点待协商';
}

function resolveProductMeetupLocation(deliveryMode?: CheckoutFormValues['deliveryMode']) {
  if (deliveryMode === 'locker_dropoff') {
    return '柜机代存（占位，后续与卖家确认）';
  }
  return '线下面交（下单后与卖家协商具体地点）';
}

function resolveProductMeetupTime() {
  return '交易时间待协商（下单后与卖家确认）';
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
  const [error, setError] = useState<string | null>(null);
  const deliveryMode = Form.useWatch('deliveryMode', form);

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
            location: buildServiceFallbackLocation(detail),
            time: getDefaultTimeLabel(),
            paymentIntent: detail.reward > 0 ? '线下面交后付款' : '无需支付',
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
            deliveryMode: 'offline_meetup',
            paymentIntent: '线下面交后付款',
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
        publisher: service.publisher
      };
    }

    if (product) {
      return {
        title: product.title,
        amount: product.detailBase.amountLabel,
        image: resolvePrimaryProductImage(product),
        publisher: product.seller
      };
    }

    return null;
  }, [mode, product, service]);

  const sellerPresentation = useMemo(
    () => (summary ? getUserPresentation(summary.publisher) : null),
    [summary]
  );
  const orderTypeLabel = mode === 'service' ? '服务订单' : '商品订单';
  const orderPriceLabel = mode === 'service' ? '服务价格' : '成交价格';
  const orderFormDescription = mode === 'service'
    ? '确认服务时间、地点和支付方式示意。'
    : '确认交付方式和支付方式示意。';
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
          initialMessage: values.note?.trim() || undefined,
          serviceLocation: values.location?.trim() || buildServiceFallbackLocation(service),
          serviceTime: values.time.trim(),
          paymentIntent: values.paymentIntent
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
        meetupLocation: resolveProductMeetupLocation(values.deliveryMode),
        meetupTime: resolveProductMeetupTime(),
        paymentIntent: values.paymentIntent,
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

  return (
    <div className="page-grid checkout-page">
      <SectionHeader
        title={mode === 'service' ? '确认服务订单' : '确认交易订单'}
        className="is-prominent is-spacious"
      />

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
              <div className="checkout-step-strip" aria-label="订单流程示意">
                {orderFlowSteps.map((step, index) => (
                  <div key={step} className="checkout-step-item">
                    <i>{index + 1}</i>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {sellerPresentation ? (
              <div className="checkout-seller-strip" aria-label="当前卖家信息">
                <div className="checkout-seller-leading">
                  <UserAvatar
                    src={sellerPresentation.avatarUrl}
                    alt={`${sellerPresentation.displayName}的头像`}
                    fallbackLabel={sellerPresentation.initial}
                    className="checkout-seller-avatar"
                  />
                  <div className="checkout-seller-copy">
                    <strong>{sellerPresentation.displayName}</strong>
                    <span>{sellerPresentation.collegeLabel}</span>
                  </div>
                </div>
                <em className="checkout-seller-caption">卖家信息</em>
                <div className={`ui-credit-badge is-${sellerPresentation.creditBadge.tone}`}>
                  <span className="ui-credit-badge-label">{sellerPresentation.creditBadge.label}</span>
                </div>
              </div>
            ) : null}

            <div className="checkout-summary">
              <img src={summary.image} alt={summary.title} />
              <div className="checkout-summary-copy">
                <h1>{summary.title}</h1>
              </div>
              <div className="checkout-price-strip">
                <span>{orderPriceLabel}</span>
                <strong>{summary.amount}</strong>
              </div>
            </div>

            <SectionHeader
              title="订单信息"
              className="is-spacious checkout-form-header"
            />

            <div className="checkout-form-pane">
            <Form form={form} layout="vertical" onFinish={(values) => void handleSubmit(values)}>
              {mode === 'service' ? (
                <Form.Item
                  label="服务地点"
                  name="location"
                  rules={[{ required: true, message: '请填写地点' }]}
                >
                  <Input prefix={<EnvironmentOutlined />} placeholder="例如：图书馆一层大厅" />
                </Form.Item>
              ) : (
                <Form.Item
                  label="交付方式"
                  name="deliveryMode"
                  rules={[{ required: true, message: '请选择交付方式' }]}
                >
                  <Radio.Group className="checkout-delivery-options">
                    <Radio.Button value="offline_meetup">线下面交</Radio.Button>
                    <Radio.Button value="locker_dropoff">柜机代存</Radio.Button>
                  </Radio.Group>
                </Form.Item>
              )}

              {mode === 'product' ? (
                <div className="checkout-delivery-placeholder">
                  <EnvironmentOutlined />
                  <div>
                    <strong>{deliveryMode === 'locker_dropoff' ? '柜机代存占位' : '线下面交待协商'}</strong>
                  </div>
                </div>
              ) : null}

              {mode === 'service' ? (
                <Form.Item
                  label="服务时间"
                  name="time"
                  rules={[{ required: true, message: '请填写时间' }]}
                >
                  <Input prefix={<CalendarOutlined />} placeholder="例如：今天 18:30" />
                </Form.Item>
              ) : null}

              <Form.Item label="支付示意" name="paymentIntent" rules={[{ required: true, message: '请选择支付方式' }]}>
                <Radio.Group className="checkout-payment-options">
                  <Radio.Button value="线下面交后付款"><PayCircleOutlined /> 线下面交后付款</Radio.Button>
                  <Radio.Button value="平台支付占位"><PayCircleOutlined /> 平台支付占位</Radio.Button>
                  <Radio.Button value="无需支付"><PayCircleOutlined /> 无需支付</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <div className="checkout-payment-placeholder">
                <PayCircleOutlined />
                <div>
                  <strong>支付能力预留</strong>
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
