import { Button, Form, Input, Modal, Radio, Select, Skeleton, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { KeyValueGrid, MetaList } from '../components/data-display';
import { SectionHeader } from '../components/layout';
import { ProductGrid, ProductSummaryCard } from '../components/product';
import { getBjfuMeetupLabel } from '../constants/campus';
import {
  createConversation,
  createOrder,
  createReport,
  fetchProductDetail,
  getApiErrorMessage,
  ProductDetail,
  recordRecommendationBehavior
} from '../services/api';
import { recordProductView, syncFavoriteSignal } from '../services/behavior';
import { isFavorite, subscribeFavorites, toggleFavorite } from '../services/favorites';
import { clearDemoUser, getDemoUser, hasTradingAccess, isGuestUser } from '../services/session';
import { resolvePrimaryProductImage, resolveProductGallery } from '../utils/productCover';

const statusMap: Record<string, { label: string; color: string }> = {
  ON_SALE: { label: '在售', color: 'green' },
  PENDING: { label: '审核中', color: 'orange' },
  SOLD: { label: '已售', color: 'default' },
  OFFLINE: { label: '已下架', color: 'red' }
};

const reportTypeOptions = [
  '商品描述与实物不符',
  '疑似诈骗或诱导站外交易',
  '违禁或不适合校园交易',
  '卖家辱骂骚扰',
  '盗图或冒用他人信息',
  '其他问题'
];

type ReportIdentityMode = 'REAL_NAME' | 'ANONYMOUS';

type ReportFormValues = {
  type: string;
  detail: string;
  identityMode: ReportIdentityMode;
  contactConsent: 'YES' | 'NO';
};

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<'chat' | 'order' | 'report' | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [favoriteVersion, setFavoriteVersion] = useState(0);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportForm] = Form.useForm<ReportFormValues>();

  useEffect(() => {
    async function load() {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = getDemoUser();
        const data = await fetchProductDetail(Number(id), currentUser?.id);
        setDetail(data);
        setActiveImage(0);
        setDescriptionExpanded(false);
      } catch {
        setDetail(null);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [id]);

  useEffect(() => subscribeFavorites(() => setFavoriteVersion((value) => value + 1)), []);

  const currentUser = useMemo(() => getDemoUser(), []);
  const favorited = useMemo(
    () => (detail ? isFavorite(detail.id, currentUser) : false),
    [detail, currentUser, favoriteVersion]
  );

  useEffect(() => {
    if (detail) {
      recordProductView(detail, currentUser);
    }
  }, [detail, currentUser]);

  function handleAuthExpired(error: unknown) {
    const maybeMessage = getApiErrorMessage(error, '');

    if (maybeMessage?.includes('登录状态已失效')) {
      clearDemoUser();
      message.error('登录状态已失效，请重新登录');
      void navigate('/login');
      return true;
    }

    return false;
  }

  function showActionError(error: unknown, fallback: string) {
    if (!handleAuthExpired(error)) {
      message.error(getApiErrorMessage(error, fallback));
    }
  }

  function ensureTradingAccess(actionLabel: string) {
    if (!currentUser) {
      message.error(`请先登录后再${actionLabel}`);
      void navigate('/login');
      return false;
    }

    if (isGuestUser(currentUser)) {
      message.error(`浏览账号不可${actionLabel}`);
      void navigate('/login');
      return false;
    }

    if (!hasTradingAccess(currentUser)) {
      message.error(`当前账号不可${actionLabel}`);
      return false;
    }

    return true;
  }

  async function handleContactSeller() {
    if (!detail) {
      return;
    }

    if (!ensureTradingAccess('联系对方')) {
      return;
    }

    const activeUser = currentUser;
    if (!activeUser) {
      return;
    }
    setSubmitting('chat');
    try {
      await recordRecommendationBehavior({
        productId: detail.id,
        eventType: 'CONTACT'
      });
      const conversation = await createConversation({
        productId: detail.id,
        initialMessage: `你好，我对“${detail.title}”感兴趣，还在吗？`
      });
      message.success(conversation.reused ? '已打开原会话' : '已发起新会话');
      void navigate('/messages', { state: { conversationId: conversation.id } });
    } catch (error) {
      showActionError(error, '联系对方失败');
    } finally {
      setSubmitting(null);
    }
  }

  async function handleCreateOrder() {
    if (!detail) {
      return;
    }

    if (!ensureTradingAccess('下单')) {
      return;
    }

    const activeUser = currentUser;
    if (!activeUser) {
      return;
    }
    setSubmitting('order');
    try {
      await recordRecommendationBehavior({
        productId: detail.id,
        eventType: 'ORDER'
      });
      await createOrder({
        productId: detail.id,
        meetupLocation: getBjfuMeetupLabel(detail.id),
        note: `想约“${detail.title}”当面交易`
      });
      message.success('下单成功，已生成订单和会话');
      void navigate('/profile', { state: { section: 'orders', orderScope: 'buying' } });
    } catch (error) {
      showActionError(error, '下单失败');
    } finally {
      setSubmitting(null);
    }
  }

  function openReportModal() {
    if (!detail) {
      return;
    }

    if (!ensureTradingAccess('举报')) {
      return;
    }

    reportForm.setFieldsValue({
      type: reportTypeOptions[0],
      detail: '',
      identityMode: currentUser?.verified ? 'REAL_NAME' : 'ANONYMOUS',
      contactConsent: 'YES'
    });
    setReportModalOpen(true);
  }

  function buildReportReason(values: ReportFormValues) {
    const activeUser = currentUser;
    const identityLabel = values.identityMode === 'REAL_NAME'
      ? `实名举报（${activeUser?.name ?? '未知用户'} / ${activeUser?.studentId || '无学号'}）`
      : '匿名展示（平台保留账号记录用于核查）';
    const contactLabel = values.contactConsent === 'YES' ? '愿意配合管理员补充材料' : '仅提交当前举报信息';

    return [
      `举报类型：${values.type}`,
      `举报方式：${identityLabel}`,
      `是否配合核查：${contactLabel}`,
      `举报说明：${values.detail.trim()}`
    ].join('\n');
  }

  async function handleReportSubmit() {
    if (!detail) {
      return;
    }

    const activeUser = currentUser;
    if (!activeUser) {
      return;
    }

    const values = await reportForm.validateFields().catch(() => null);
    if (!values) {
      return;
    }

    setSubmitting('report');
    try {
      await createReport({
        productId: detail.id,
        targetUserId: detail.seller.id,
        reason: buildReportReason(values)
      });
      reportForm.resetFields();
      setReportModalOpen(false);
      message.success('举报已提交');
    } catch (error) {
      showActionError(error, '举报提交失败');
    } finally {
      setSubmitting(null);
    }
  }

  async function handleToggleFavorite() {
    if (!detail) {
      return;
    }

    const nextState = await toggleFavorite(detail.id, currentUser);
    syncFavoriteSignal(detail, nextState, currentUser);
    setFavoriteVersion((value) => value + 1);
    message.success(nextState ? '已加入想要' : '已取消想要');
  }

  if (loading) {
    return <Skeleton active paragraph={{ rows: 14 }} />;
  }

  if (!detail) {
    return (
      <div className="page-grid">
        <section className="hero-panel">
          <div className="hero-chip-row">
            <span className="hero-chip">商品详情</span>
            <span className="hero-chip">站内交易</span>
          </div>
          <h1 className="hero-title">商品不存在</h1>
        </section>
      </div>
    );
  }

  const status = statusMap[detail.status] ?? { label: detail.status, color: 'default' };
  const detailImages = resolveProductGallery(
    {
      ...detail,
      sellerName: detail.seller.name
    },
    detail.id,
    4
  );
  const currentImage = detailImages[activeImage] ?? detailImages[0];
  const primaryMeetup = getBjfuMeetupLabel(detail.id);
  const secondaryMeetup = getBjfuMeetupLabel(detail.id + 1);
  const sellerMoreItems = detail.relatedProducts.slice(0, 3);
  const detailMeta = [
    { label: '品牌', value: detail.category },
    { label: '成色', value: detail.condition },
    { label: '卖家状态', value: detail.seller.verified ? '实名认证' : '普通账号' },
    { label: '信用等级', value: detail.seller.creditLevel },
    { label: '交易地点', value: `${primaryMeetup} / ${secondaryMeetup}` },
    { label: '发布时间', value: new Date(detail.publishedAt).toLocaleDateString() }
  ];
  const detailDescription = descriptionExpanded || detail.description.length <= 88
    ? detail.description
    : `${detail.description.slice(0, 88)}...`;
  const sellerIdentity = detail.seller.verified ? '卖家信用优秀' : '卖家信用良好';
  const sellerStats = [
    detail.seller.college,
    `${detail.seller.responseRate}% 回复率`,
    `卖出 ${detail.seller.completedOrders} 件宝贝`,
    `好评率 ${Math.min(99, Math.max(82, Math.round(detail.seller.averageRating * 20)))}%`
  ];

  return (
    <div className="detail-page">
      <section className="detail-seller-strip">
        <Link
          to={`/users/${detail.seller.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="detail-seller-strip-main detail-seller-link"
          aria-label={`打开${detail.seller.name}的主页`}
        >
          <div className="detail-seller-avatar">{detail.seller.name.slice(0, 1)}</div>
          <div className="detail-seller-strip-copy">
            <div className="detail-seller-strip-title">
              <strong>{detail.seller.name}</strong>
              <span>{sellerIdentity}</span>
            </div>
            <MetaList items={sellerStats} className="detail-seller-strip-meta" />
          </div>
        </Link>
        <div className="detail-seller-strip-badge">校园号</div>
      </section>

      <section className="detail-main-card">
        <div className="detail-main-layout">
          <div className="detail-thumb-column">
            {detailImages.map((image, index) => (
              <button
                key={`${detail.id}-${index}`}
                type="button"
                className={index === activeImage ? 'detail-thumb active' : 'detail-thumb'}
                onClick={() => setActiveImage(index)}
              >
                <img src={image} alt={`${detail.title}-${index + 1}`} />
              </button>
            ))}
          </div>

          <div className="detail-main-photo-shell">
            <img
              className="detail-main-photo"
              src={currentImage}
              alt={detail.title}
            />
            <div className="detail-photo-overlay">
              <span>{detail.category}</span>
              <strong>{activeImage + 1} / {detailImages.length}</strong>
            </div>
          </div>

          <aside className="detail-info-panel">
            <div className="detail-info-head">
              <div className="detail-price-line">
                <strong>¥{detail.price}</strong>
                <span>同校面交</span>
              </div>
              <div className="detail-condition-mark">{detail.condition}</div>
            </div>

            <div className="detail-heat-line">
              <span>{detail.stats.wantCount} 人想要</span>
              <span>{detail.stats.viewCount} 浏览</span>
            </div>

            <h1 className="detail-main-title">{detail.title}</h1>

            <div className="detail-description-block">
              <p>{detailDescription}</p>
              {detail.description.length > 88 ? (
                <button
                  type="button"
                  className="detail-expand-button"
                  onClick={() => setDescriptionExpanded((current) => !current)}
                >
                  {descriptionExpanded ? '收起' : '展开'}
                </button>
              ) : null}
            </div>

            <KeyValueGrid
              items={detailMeta.map((item) => ({ key: item.label, label: item.label, value: item.value }))}
              className="detail-main-meta-grid"
              emphasizeValue
            />

            <div className="detail-main-actions">
              <Button type="primary" size="large" onClick={() => void handleContactSeller()} loading={submitting === 'chat'}>
                聊一聊
              </Button>
              <Button size="large" onClick={() => void handleCreateOrder()} loading={submitting === 'order'}>
                立即购买
              </Button>
              <button type="button" className={favorited ? 'detail-favorite-button active' : 'detail-favorite-button'} onClick={handleToggleFavorite}>
                {favorited ? '已收藏' : '收藏'}
              </button>
            </div>

            <div className="detail-bottom-line">
              <span>{detail.stats.favoriteCount} 收藏</span>
              <button type="button" className="detail-quiet-action warn" onClick={openReportModal}>
                {submitting === 'report' ? '提交中...' : '举报'}
              </button>
            </div>
          </aside>
        </div>
      </section>

      <Modal
        title="提交举报"
        open={reportModalOpen}
        onCancel={() => setReportModalOpen(false)}
        onOk={() => void handleReportSubmit()}
        okText="提交举报"
        cancelText="取消"
        confirmLoading={submitting === 'report'}
        width={560}
      >
        <Form
          form={reportForm}
          layout="vertical"
          className="detail-report-form"
          initialValues={{
            type: reportTypeOptions[0],
            identityMode: currentUser?.verified ? 'REAL_NAME' : 'ANONYMOUS',
            contactConsent: 'YES'
          }}
        >
          <Form.Item name="type" label="举报类型" rules={[{ required: true, message: '请选择举报类型' }]}>
            <Select options={reportTypeOptions.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item name="identityMode" label="举报方式" rules={[{ required: true }]}>
            <Radio.Group className="detail-report-radio">
              <Radio value="REAL_NAME">实名举报</Radio>
              <Radio value="ANONYMOUS">匿名展示</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="contactConsent" label="后续核查" rules={[{ required: true }]}>
            <Radio.Group className="detail-report-radio">
              <Radio value="YES">愿意配合管理员补充材料</Radio>
              <Radio value="NO">仅提交当前信息</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="detail"
            label="举报说明"
            rules={[
              { required: true, message: '请填写举报说明' },
              { min: 8, message: '说明至少 8 个字' }
            ]}
          >
            <Input.TextArea
              rows={5}
              maxLength={300}
              showCount
              placeholder="请描述问题、聊天经过、交易时间或可核查线索"
            />
          </Form.Item>
        </Form>
      </Modal>

      <section className="detail-bottom-layout">
        <div className="detail-card detail-balance-card">
          <SectionHeader title="对方在售" description={`${sellerMoreItems.length} 件`} />
          <div className="ui-split-list">
            {sellerMoreItems.map((item) => (
              <Link key={item.id} to={`/products/${item.id}`} className="ui-split-list-row is-link">
                <div className="ui-split-list-copy">
                  <strong>{item.title}</strong>
                  <span>{item.condition} · {item.category}</span>
                </div>
                <span className="ui-split-list-aside is-highlight">¥{item.price}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="detail-card detail-balance-card">
          <SectionHeader title="交易保障" description={status.label} />
          <div className="ui-split-list">
            {detail.compliance.trustSignals.slice(0, 3).map((signal) => (
              <div key={signal} className="ui-split-list-row">
                <div className="ui-split-list-copy">
                  <strong>{signal}</strong>
                  <span>支持校内当面交易</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="detail-related">
        <div className="fish-feed-header">
          <h2>相似推荐</h2>
        </div>
        <ProductGrid
          items={detail.relatedProducts}
          className="fish-feed-grid detail-feed-grid"
          renderItem={(item) => (
            <Link key={item.id} to={`/products/${item.id}`} className="detail-related-link">
              <ProductSummaryCard
                className="detail-related-card"
                item={item}
                imageSrc={resolvePrimaryProductImage(item, item.id)}
                signal={`${item.category} · ${item.condition}`}
                secondaryMeta={item.recommendationReason ?? '同校热卖'}
                tertiaryMeta={<span>{item.sellerName}</span>}
              />
            </Link>
          )}
        />
      </section>
    </div>
  );
}
