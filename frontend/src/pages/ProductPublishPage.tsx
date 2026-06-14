import { Alert, Button, Checkbox, Form, Input, InputNumber, Modal, Select, message as antMessage } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ActionRow, SectionHeader } from '../components/layout';
import { CampusServicePublishWorkbench, PublishImageManager, type PublishImageItem } from '../components/publish';
import {
  defaultAllowedCategories,
  defaultCommunityNotices,
  defaultDormElectricalWhitelist,
  defaultProhibitedKeywords,
  defaultReviewFlow,
  defaultRuleHighlights,
  defaultServiceCommunityNotices,
  defaultServiceProhibitedItems,
  defaultServiceReviewFlow,
  defaultServiceRuleHighlights,
  defaultServiceTrustSignals,
  defaultTrustSignals,
  PublishRulesDocument
} from '../components/product';
import { SectionCard } from '../components/ui';
import { useAuthState } from '../services/auth-state';
import { fetchPublishingRules, getApiErrorMessage, type PublishingRules } from '../services/api';
import { createProductWithImages, uploadProductImageAsset } from '../services/product-publish';
import { hasTradingAccess, isGuestUser } from '../services/session';

const PUBLISH_RULES_STORAGE_KEY = 'swapcampus:publish-rules-dismiss-until';
const PUBLISH_RULES_SUPPRESS_DAYS = 7;
const PUBLISH_RULES_WAIT_SECONDS = 8;
const DEFAULT_PUBLISH_CONDITION = '未说明';

type PublishType = 'product' | 'service-request' | 'service-offer';

type ProductPublishFormValues = {
  title: string;
  category: string;
  price: number;
  description: string;
  tags?: string;
};

function buildPublishTags(values: {
  title: string;
  category: string;
  tags?: string;
}) {
  return (values.tags ?? '')
    .split(/[，,、/\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function ProductPublishPage() {
  const { currentUser } = useAuthState();
  const [form] = Form.useForm<ProductPublishFormValues>();
  const [publishType, setPublishType] = useState<PublishType>('product');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [rules, setRules] = useState<PublishingRules | null>(null);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rememberRulesChoice, setRememberRulesChoice] = useState(false);
  const [hasReachedRuleEnd, setHasReachedRuleEnd] = useState(false);
  const [rulesCountdown, setRulesCountdown] = useState(PUBLISH_RULES_WAIT_SECONDS);
  const [uploadedImages, setUploadedImages] = useState<PublishImageItem[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const rulesScrollRef = useRef<HTMLDivElement | null>(null);
  const uploadedImagesRef = useRef<PublishImageItem[]>([]);

  const allowedCategories = rules?.allowedCategories ?? defaultAllowedCategories;
  const dormElectricalWhitelist = rules?.dormElectricalWhitelist ?? defaultDormElectricalWhitelist;
  const communityNotices = rules?.communityNotices ?? defaultCommunityNotices;
  const ruleHighlights = rules?.ruleHighlights ?? defaultRuleHighlights;
  const prohibitedKeywords = rules?.prohibitedKeywords ?? defaultProhibitedKeywords;
  const reviewFlow = rules?.reviewFlow ?? defaultReviewFlow;
  const trustSignals = rules?.trustSignals ?? defaultTrustSignals;
  const shouldUseRulesGate = publishType === 'product' || publishType === 'service-request' || publishType === 'service-offer';
  const isServicePublish = publishType === 'service-request' || publishType === 'service-offer';

  useEffect(() => {
    fetchPublishingRules().then(setRules).catch(() => setRules(null));
  }, []);

  useEffect(() => {
    uploadedImagesRef.current = uploadedImages;
  }, [uploadedImages]);

  useEffect(() => () => {
    uploadedImagesRef.current.forEach((item) => {
      if (item.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
  }, []);

  useEffect(() => {
    if (!shouldUseRulesGate) {
      setRulesModalOpen(false);
      return;
    }

    try {
      const raw = window.localStorage.getItem(PUBLISH_RULES_STORAGE_KEY);
      if (raw) {
        const dismissUntil = Number(raw);
        if (Number.isFinite(dismissUntil) && dismissUntil > Date.now()) {
          return;
        }
        window.localStorage.removeItem(PUBLISH_RULES_STORAGE_KEY);
      }
    } catch {
      // ignore local storage failures and fall through to modal gate
    }

    setRulesModalOpen(true);
  }, [shouldUseRulesGate]);

  useEffect(() => {
    if (!rulesModalOpen || !hasReachedRuleEnd || rulesCountdown <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setRulesCountdown((value) => Math.max(value - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [hasReachedRuleEnd, rulesCountdown, rulesModalOpen]);

  useEffect(() => {
    if (!rulesModalOpen || !rulesScrollRef.current) {
      return;
    }

    const node = rulesScrollRef.current;
    if (node.scrollHeight <= node.clientHeight + 4) {
      setHasReachedRuleEnd(true);
    }
  }, [allowedCategories.length, communityNotices.length, dormElectricalWhitelist.length, rulesModalOpen]);

  async function handleSubmit(values: ProductPublishFormValues) {
    if (!hasTradingAccess(currentUser)) {
      setMessage({ type: 'error', text: isGuestUser(currentUser) ? '浏览账号不可发布商品。' : '请先登录后再发布商品。' });
      return;
    }

    if (!uploadedImages.length) {
      setMessage({ type: 'error', text: '请至少上传 1 张商品图片。' });
      antMessage.error('请至少上传 1 张商品图片');
      return;
    }

    const finalTags = buildPublishTags(values);

    setSubmittingProduct(true);
    try {
      const result = await createProductWithImages({
        title: values.title,
        description: values.description,
        price: values.price,
        category: values.category,
        condition: DEFAULT_PUBLISH_CONDITION,
        tags: finalTags,
        imageUrls: uploadedImages.map((item) => item.url)
      });

      setMessage({ type: 'success', text: `商品已提交：${result.title}（ID ${result.id}，状态 ${result.status}）` });
      form.resetFields();
      setUploadedImages((current) => {
        current.forEach((item) => {
          if (item.previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(item.previewUrl);
          }
        });
        return [];
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: getApiErrorMessage(error, '发布失败，请稍后重试。')
      });
    } finally {
      setSubmittingProduct(false);
    }
  }

  function handleRulesScroll() {
    const node = rulesScrollRef.current;
    if (!node || hasReachedRuleEnd) {
      return;
    }

    if (node.scrollTop + node.clientHeight >= node.scrollHeight - 12) {
      setHasReachedRuleEnd(true);
    }
  }

  function handleRulesAccept() {
    if (!hasReachedRuleEnd || rulesCountdown > 0) {
      return;
    }

    try {
      if (rememberRulesChoice) {
        window.localStorage.setItem(
          PUBLISH_RULES_STORAGE_KEY,
          String(Date.now() + PUBLISH_RULES_SUPPRESS_DAYS * 24 * 60 * 60 * 1000)
        );
      } else {
        window.localStorage.removeItem(PUBLISH_RULES_STORAGE_KEY);
      }
    } catch {
      // ignore local storage failures and continue
    }

    setRulesModalOpen(false);
  }

  async function handleProductImageUpload(file: File) {
    setUploadingImage(true);
    try {
      return await uploadProductImageAsset(file);
    } catch (error) {
      antMessage.error(getApiErrorMessage(error, '商品图片上传失败'));
      throw error;
    } finally {
      setUploadingImage(false);
    }
  }

  const rulesGateReady = hasReachedRuleEnd && rulesCountdown === 0;
  const rulesGateButtonLabel = !hasReachedRuleEnd
    ? '请先拉到底'
    : rulesCountdown > 0
      ? `${rulesCountdown}s 后可同意`
      : '已阅读并同意';
  const isProductPublish = publishType === 'product';
  const servicePresetIntent = publishType === 'service-offer' ? 'OFFER' : 'REQUEST';
  const rulesModalTitle = isServicePublish ? '发布规则与服务约束确认' : '发布规则确认';
  const rulesLinkLabel = isServicePublish ? '查看发布规则和服务发布约束' : '查看发布规则';
  const publishTypeOptions: Array<{
    key: PublishType;
    eyebrow: string;
    title: string;
  }> = [
    {
      key: 'product',
      eyebrow: '闲置交易',
      title: '发布商品'
    },
    {
      key: 'service-request',
      eyebrow: '校园服务',
      title: '找人帮我'
    },
    {
      key: 'service-offer',
      eyebrow: '校园服务',
      title: '我来提供'
    }
  ];

  return (
    <div id="publish-top" className="page-grid publish-page publish-workbench-page">
      <Modal
        open={shouldUseRulesGate && rulesModalOpen}
        closable={false}
        maskClosable={false}
        keyboard={false}
        title={rulesModalTitle}
        width={720}
        footer={(
          <div className="publish-rules-modal-footer">
            <Checkbox checked={rememberRulesChoice} onChange={(event) => setRememberRulesChoice(event.target.checked)}>
              {`${PUBLISH_RULES_SUPPRESS_DAYS} 天内不再显示`}
            </Checkbox>
            <Button type="primary" disabled={!rulesGateReady} onClick={handleRulesAccept}>
              {rulesGateButtonLabel}
            </Button>
          </div>
        )}
      >
        <div ref={rulesScrollRef} className="publish-rules-modal-scroll" onScroll={handleRulesScroll}>
          <PublishRulesDocument
            allowedCategories={allowedCategories}
            communityNotices={communityNotices}
            dormElectricalWhitelist={dormElectricalWhitelist}
            prohibitedKeywords={prohibitedKeywords}
            reviewFlow={reviewFlow}
            ruleHighlights={ruleHighlights}
            trustSignals={trustSignals}
            serviceCommunityNotices={defaultServiceCommunityNotices}
            serviceProhibitedItems={defaultServiceProhibitedItems}
            serviceReviewFlow={defaultServiceReviewFlow}
            serviceRuleHighlights={defaultServiceRuleHighlights}
            serviceTrustSignals={defaultServiceTrustSignals}
          />
        </div>
      </Modal>

      <div className="publish-layout">
        <section className="publish-type-panel">
          <div className="publish-type-panel-head">
            <SectionHeader title="发布类型" className="is-prominent" />
          </div>
          <div className="publish-type-grid" role="tablist" aria-label="发布类型">
            {publishTypeOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={publishType === option.key}
                className={['publish-type-card', publishType === option.key ? 'is-active' : ''].filter(Boolean).join(' ')}
                onClick={() => setPublishType(option.key)}
              >
                <span className="publish-type-eyebrow">{option.eyebrow}</span>
                <strong>{option.title}</strong>
              </button>
            ))}
          </div>
        </section>

        {isProductPublish ? (
          <div className="publish-workbench-main">
            <SectionCard
              className="publish-main-card publish-editor-card"
              title={<SectionHeader title="商品信息" className="is-prominent" />}
            >
              {message ? <Alert style={{ marginBottom: 16 }} type={message.type} showIcon message={message.text} /> : null}
              <Form form={form} layout="vertical" onFinish={(values) => void handleSubmit(values)} className="form-shell publish-form">
                <PublishImageManager
                  title="商品图片"
                  modalTitle="上传商品图片"
                  items={uploadedImages}
                  uploading={uploadingImage}
                  onChange={setUploadedImages}
                  onUpload={handleProductImageUpload}
                />

                <div className="publish-form-grid">
                  <Form.Item name="title" label="商品标题" rules={[{ required: true, message: '请输入商品标题' }]}>
                    <Input placeholder="例如：九成新计算机网络教材" maxLength={40} showCount />
                  </Form.Item>
                  <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
                    <Select options={allowedCategories.map((item) => ({ value: item }))} placeholder="请选择分类" />
                  </Form.Item>
                  <Form.Item name="price" label="价格" rules={[{ required: true, message: '请输入价格' }]}>
                    <InputNumber min={0} style={{ width: '100%' }} controls={false} prefix="¥" placeholder="88" />
                  </Form.Item>
                  <div className="publish-form-span-2 publish-description-group">
                    <Form.Item name="description" label="描述" rules={[{ required: true, message: '请输入商品描述' }]}>
                      <Input.TextArea rows={7} placeholder="写清使用情况、配件、容量/版本、可交易地点。" maxLength={240} showCount />
                    </Form.Item>
                  </div>
                </div>

                <Form.Item name="tags" label="标签">
                  <Input placeholder="例如：教材, 考试周, 可验货" />
                </Form.Item>

                <ActionRow className="publish-submit-row">
                  <Button type="primary" htmlType="submit" loading={submittingProduct}>发布商品</Button>
                </ActionRow>
              </Form>
            </SectionCard>
          </div>
        ) : (
          <CampusServicePublishWorkbench
            sectionTitle={publishType === 'service-offer' ? '发布可预约服务' : '发布服务需求'}
            presetIntent={servicePresetIntent}
            variant="publish"
            enableRulesGate={false}
          />
        )}
      </div>

      {isProductPublish ? (
        <div className="publish-rules-link-row">
          <Link className="publish-rules-anchor" to="/publish/rules">{rulesLinkLabel}</Link>
        </div>
      ) : (
        <div className="publish-rules-link-row">
          <Link className="publish-rules-anchor" to="/publish/rules">{rulesLinkLabel}</Link>
        </div>
      )}

    </div>
  );
}
