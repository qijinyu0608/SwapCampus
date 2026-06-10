import { StarFilled, StarOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Radio, Select, Skeleton, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MetaList } from '../components/data-display';
import { DetailShell, SectionHeader } from '../components/layout';
import { ProductGrid, ProductSummaryCard } from '../components/product';
import { getBjfuMeetupLabel } from '../constants/campus';
import { useAuthState } from '../services/auth-state';
import {
  createConversation,
  createOrder,
  createReport,
  fetchProductDetail,
  getApiErrorMessage,
  type ProductDetailView
} from '../services/api';
import { isFavorite, subscribeFavorites, toggleFavorite } from '../services/favorites';
import { hasTradingAccess, isGuestUser } from '../services/session';
import { resolvePrimaryProductImage, resolveProductGallery } from '../utils/productCover';
import { getListingStatusPresentation } from '../utils/listingStatus';
import { getUserPresentation } from '../utils/userPresentation';

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
  const { currentUser, clearCurrentUser } = useAuthState();
  const [detail, setDetail] = useState<ProductDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<'chat' | 'order' | 'report' | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [favoriteVersion, setFavoriteVersion] = useState(0);
  const [favoriteAnimating, setFavoriteAnimating] = useState(false);
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
        const data = await fetchProductDetail(Number(id));
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

  const favorited = useMemo(
    () => (detail ? isFavorite(detail.id, currentUser) : false),
    [detail, currentUser, favoriteVersion]
  );

  function handleAuthExpired(error: unknown) {
    const maybeMessage = getApiErrorMessage(error, '');

    if (maybeMessage?.includes('登录状态已失效')) {
      clearCurrentUser();
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
      identityMode: currentUser?.verificationStatus === 'APPROVED' ? 'REAL_NAME' : 'ANONYMOUS',
      contactConsent: 'YES'
    });
    setReportModalOpen(true);
  }

  function buildReportReason(values: ReportFormValues) {
    const activeUser = currentUser;
    const identityLabel = values.identityMode === 'REAL_NAME'
      ? `实名举报（${activeUser?.displayName ?? '未知用户'} / ${activeUser?.studentId || '无学号'}）`
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

    try {
      setFavoriteAnimating(false);
      const nextState = await toggleFavorite(detail.id, currentUser);
      setFavoriteVersion((value) => value + 1);
      if (nextState) {
        setFavoriteAnimating(true);
        window.setTimeout(() => setFavoriteAnimating(false), 520);
      }
      message.success(nextState ? '已加入想要' : '已取消想要');
    } catch (error) {
      showActionError(error, '收藏操作失败');
    }
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

  const detailImages = resolveProductGallery(
    {
      ...detail,
      sellerName: detail.seller.displayName
    },
    detail.id,
    4
  );
  const currentImage = detailImages[activeImage] ?? detailImages[0];
  const sellerPresentation = getUserPresentation(detail.seller);
  const detailDescription = descriptionExpanded || detail.detailBase.description.length <= 88
    ? detail.detailBase.description
    : `${detail.detailBase.description.slice(0, 88)}...`;
  const sellerIdentity = sellerPresentation.creditBadge.label;
  const statusPresentation = getListingStatusPresentation(detail.detailBase.status, detail.detailBase.statusLabel);
  const sellerStats = [
    detail.seller.college,
    `${detail.seller.responseRate}% 回复率`,
    `完成 ${detail.seller.completedOrders} 单`,
    `评分 ${detail.seller.averageRating.toFixed(1)}`
  ];

  return (
    <div className="detail-page">
      <section className="detail-seller-strip">
        <Link
          to={`/users/${detail.seller.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="detail-seller-strip-main detail-seller-link"
          aria-label={`打开${detail.seller.displayName}的主页`}
        >
          <div className="detail-seller-strip-copy">
            <div className="detail-seller-strip-title">
              <strong>{detail.seller.displayName}</strong>
              <div className={`ui-credit-badge is-${sellerPresentation.creditBadge.tone}`}>
                <span className="ui-credit-badge-label">{sellerIdentity}</span>
              </div>
            </div>
            <MetaList items={sellerStats} className="detail-seller-strip-meta" />
          </div>
        </Link>
      </section>

      <DetailShell
        mainMedia={(
          <div className="detail-main-layout-product">
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
          </div>
        )}
        sidePanel={(
          <div className="detail-info-panel">
            <div className="detail-info-top">
              <div className="detail-topline">
                <div className="detail-heat-line">
                  <span>{detail.stats.wantCount} 人想要</span>
                  <span>{detail.stats.favoriteCount} 收藏</span>
                  <span>{detail.stats.viewCount} 浏览</span>
                </div>

                <button
                  type="button"
                  aria-label={favorited ? '取消收藏' : '收藏商品'}
                  className={[
                    'detail-favorite-star',
                    favorited ? 'active' : '',
                    favoriteAnimating ? 'is-popping' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => void handleToggleFavorite()}
                >
                  {favorited ? <StarFilled /> : <StarOutlined />}
                </button>
              </div>

              <div className="detail-price-block">
                <div className="listing-detail-amount">
                  <strong>{detail.detailBase.amountLabel}</strong>
                  <div className="detail-price-meta">
                    <span className="detail-condition-inline">{detail.condition}</span>
                    <span>同校面交</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="detail-info-body">
              <h1 className="detail-main-title">{detail.detailBase.title}</h1>
              <div className="detail-description-block">
                <p>{detailDescription}</p>
                {detail.detailBase.description.length > 88 ? (
                  <button
                    type="button"
                    className="detail-expand-button"
                    onClick={() => setDescriptionExpanded((current) => !current)}
                  >
                    {descriptionExpanded ? '收起' : '展开'}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="detail-info-foot">
              <div className="detail-main-actions">
                <Button type="primary" size="large" onClick={() => void handleContactSeller()} loading={submitting === 'chat'}>
                  聊一聊
                </Button>
                <Button size="large" onClick={() => void handleCreateOrder()} loading={submitting === 'order'}>
                  立即购买
                </Button>
              </div>

              <div className="detail-bottom-line">
                <button type="button" className="detail-quiet-action warn" onClick={openReportModal}>
                  {submitting === 'report' ? '提交中...' : '举报'}
                </button>
              </div>
            </div>
          </div>
        )}
        bottomContent={(
          <div className="detail-bottom-layout">
            <div className="detail-card detail-balance-card">
              <SectionHeader title="交易保障" description={statusPresentation.label} />
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
          </div>
        )}
      />

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
            identityMode: currentUser?.verificationStatus === 'APPROVED' ? 'REAL_NAME' : 'ANONYMOUS',
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
                priceMeta="同校在售"
                tagItems={[item.sellerName, '相似推荐']}
              />
            </Link>
          )}
        />
      </section>
    </div>
  );
}
