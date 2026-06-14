import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Dayjs } from 'dayjs';
import { ActionRow, PageCard, SectionHeader } from '../layout';
import { CAMPUS_SERVICE_CATEGORY_OPTIONS } from '../../constants/campusServiceCategories';
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
} from '../product';
import { useAuthState } from '../../services/auth-state';
import {
  type CampusServiceCategory,
  type CampusServiceCreatePayload,
  createCampusServiceListing,
  type CampusServiceFulfillmentMode,
  getApiErrorMessage,
  type CampusServiceIntent,
  type CampusServicePattern,
  type CampusServicePriceMode,
  type CampusServiceUrgency,
  fetchPublishingRules,
  type PublishingRules,
  uploadImageAsset
} from '../../services/api';
import { hasTradingAccess, isGuestUser } from '../../services/session';
import { PublishImageManager, type PublishImageItem } from './PublishImageManager';

const PUBLISH_RULES_STORAGE_KEY = 'swapcampus:service-publish-rules-dismiss-until';
const PUBLISH_RULES_SUPPRESS_DAYS = 7;
const PUBLISH_RULES_WAIT_SECONDS = 8;

function formatDateTimeForPicker(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function parsePickerValue(value: Dayjs | string) {
  if (typeof value !== 'string') {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const normalized = value.trim().replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const moduleConfig = CAMPUS_SERVICE_CATEGORY_OPTIONS.filter((item) => item.key !== 'HELP');

const urgencyOptions: Array<{ value: CampusServiceUrgency; label: string }> = [
  { value: 'NORMAL', label: '普通' },
  { value: 'TODAY', label: '今日内' },
  { value: 'URGENT', label: '加急' }
];

const intentOptions: Array<{ value: CampusServiceIntent; label: string }> = [
  { value: 'REQUEST', label: '找人帮我' },
  { value: 'OFFER', label: '我来提供' }
];

const patternOptions: Array<{ value: CampusServicePattern; label: string }> = [
  { value: 'ONE_TIME', label: '一次性' },
  { value: 'REUSABLE', label: '持续可约' }
];

const fulfillmentModeOptions: Array<{ value: CampusServiceFulfillmentMode; label: string }> = [
  { value: 'FLEXIBLE', label: '灵活交付' },
  { value: 'FACE_TO_FACE', label: '当面交付' },
  { value: 'DROP_OFF', label: '放置交付' }
];

const priceModeOptions: Array<{ value: CampusServicePriceMode; label: string }> = [
  { value: 'FIXED', label: '固定金额' },
  { value: 'NEGOTIABLE', label: '面议' },
  { value: 'FREE', label: '免费' }
];

const MIN_VALID_MINUTES = 30;
const MAX_VALID_DAYS = 30;

type PublishFormValues = {
  intent: CampusServiceIntent;
  pattern: CampusServicePattern;
  title: string;
  category: CampusServiceCategory;
  description: string;
  priceMode: CampusServicePriceMode;
  reward?: number;
  locationNote?: string;
  validUntilAt: Dayjs | string;
  estimatedMinutes: number;
  urgency?: CampusServiceUrgency;
  fulfillmentMode?: CampusServiceFulfillmentMode;
  itemCount?: number;
  maxTotalOrders?: number | null;
  maxConcurrentOrders?: number;
  autoConfirm?: boolean;
  trustNote?: string;
};

type CampusServicePublishWorkbenchProps = {
  sectionTitle?: string;
  presetIntent?: CampusServiceIntent;
  variant?: 'default' | 'publish';
  enableRulesGate?: boolean;
};

function resolveDefaultAutoConfirm(intent: CampusServiceIntent, pattern: CampusServicePattern) {
  return intent === 'OFFER' && pattern === 'REUSABLE';
}

function resolveDefaultMaxTotalOrders(pattern: CampusServicePattern) {
  return pattern === 'ONE_TIME' ? 1 : null;
}

function buildPublishStrategy(intent: CampusServiceIntent, pattern: CampusServicePattern) {
  const autoConfirm = resolveDefaultAutoConfirm(intent, pattern);
  const maxTotalOrders = resolveDefaultMaxTotalOrders(pattern);

  return {
    autoConfirm,
    maxTotalOrders,
    maxConcurrentOrders: 1
  };
}

export function CampusServicePublishWorkbench({
  sectionTitle = '发布服务',
  presetIntent,
  variant = 'default',
  enableRulesGate = true
}: CampusServicePublishWorkbenchProps) {
  const navigate = useNavigate();
  const { currentUser } = useAuthState();
  const [form] = Form.useForm<PublishFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<PublishImageItem[]>([]);
  const [rules, setRules] = useState<PublishingRules | null>(null);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rememberRulesChoice, setRememberRulesChoice] = useState(false);
  const [hasReachedRuleEnd, setHasReachedRuleEnd] = useState(false);
  const [rulesCountdown, setRulesCountdown] = useState(PUBLISH_RULES_WAIT_SECONDS);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const uploadedImagesRef = useRef<PublishImageItem[]>([]);
  const rulesScrollRef = useRef<HTMLDivElement | null>(null);
  const watchedIntent = Form.useWatch('intent', form);
  const intent = presetIntent ?? watchedIntent ?? 'REQUEST';
  const pattern = Form.useWatch('pattern', form) ?? 'ONE_TIME';
  const priceMode = Form.useWatch('priceMode', form) ?? 'FIXED';
  const publishStrategy = useMemo(() => buildPublishStrategy(intent, pattern), [intent, pattern]);
  const allowedCategories = rules?.allowedCategories ?? defaultAllowedCategories;
  const dormElectricalWhitelist = rules?.dormElectricalWhitelist ?? defaultDormElectricalWhitelist;
  const communityNotices = rules?.communityNotices ?? defaultCommunityNotices;
  const ruleHighlights = rules?.ruleHighlights ?? defaultRuleHighlights;
  const prohibitedKeywords = rules?.prohibitedKeywords ?? defaultProhibitedKeywords;
  const reviewFlow = rules?.reviewFlow ?? defaultReviewFlow;
  const trustSignals = rules?.trustSignals ?? defaultTrustSignals;

  function applyPublishStrategy(nextIntent: CampusServiceIntent, nextPattern: CampusServicePattern) {
    const nextStrategy = buildPublishStrategy(nextIntent, nextPattern);
    const currentReward = form.getFieldValue('reward');

    form.setFieldsValue({
      intent: presetIntent ?? nextIntent,
      autoConfirm: nextStrategy.autoConfirm,
      maxTotalOrders: nextStrategy.maxTotalOrders,
      maxConcurrentOrders: nextStrategy.maxConcurrentOrders,
      priceMode: form.getFieldValue('priceMode') ?? 'FIXED',
      reward: currentReward
    });
  }

  useEffect(() => {
    if (!presetIntent) {
      return;
    }

    applyPublishStrategy(presetIntent, form.getFieldValue('pattern') ?? 'ONE_TIME');
  }, [form, presetIntent]);

  useEffect(() => {
    if (!enableRulesGate) {
      return;
    }
    fetchPublishingRules().then(setRules).catch(() => setRules(null));
  }, [enableRulesGate]);

  useEffect(() => {
    if (!enableRulesGate) {
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
  }, [enableRulesGate]);

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

  async function handleServiceImageUpload(file: File) {
    setUploadingImage(true);
    try {
      return await uploadImageAsset(file, 'product');
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '服务图片上传失败') });
      throw error;
    } finally {
      setUploadingImage(false);
    }
  }

  async function handlePublish(values: PublishFormValues) {
    if (!hasTradingAccess(currentUser)) {
      setMessage({
        type: 'error',
        text: isGuestUser(currentUser) ? '浏览账号不能发布校园服务任务。' : '请先登录普通用户账号后再发布。'
      });
      return;
    }

    if (!uploadedImages.length) {
      setMessage({ type: 'error', text: '请至少上传 1 张服务图片。' });
      return;
    }

    setSubmitting(true);
    try {
      const parsedValidUntilAt = parsePickerValue(values.validUntilAt);
      if (!parsedValidUntilAt) {
        setMessage({
          type: 'error',
          text: '有效截止时间格式无效，请重新选择。'
        });
        return;
      }

      const now = new Date();
      const validMinutes = (parsedValidUntilAt.getTime() - now.getTime()) / (60 * 1000);
      if (validMinutes < MIN_VALID_MINUTES) {
        setMessage({
          type: 'error',
          text: `有效期不能短于 ${MIN_VALID_MINUTES} 分钟。`
        });
        return;
      }

      if (validMinutes > MAX_VALID_DAYS * 24 * 60) {
        setMessage({
          type: 'error',
          text: `有效期不能超过 ${MAX_VALID_DAYS} 天。`
        });
        return;
      }

      if (values.maxTotalOrders && values.maxConcurrentOrders && values.maxConcurrentOrders > values.maxTotalOrders) {
        setMessage({
          type: 'error',
          text: '同时进行中上限不能高于总名额上限。'
        });
        return;
      }

      const payload: CampusServiceCreatePayload = {
        ...values,
        intent,
        validFromAt: now.toISOString(),
        validUntilAt: parsedValidUntilAt.toISOString(),
        amount: values.priceMode === 'FREE' ? 0 : values.reward,
        reward: values.priceMode === 'FREE' ? 0 : values.reward,
        maxTotalOrders: values.maxTotalOrders ?? undefined,
        locationNote: values.locationNote?.trim() || undefined,
        contactPreference: 'CHAT_ONLY',
        deadlineLabel: formatDateTimeForPicker(parsedValidUntilAt),
        autoConfirm: values.autoConfirm ?? publishStrategy.autoConfirm,
        imageUrls: uploadedImages.map((item) => item.url)
      };

      if (values.priceMode !== 'FIXED') {
        delete payload.reward;
      }

      const created = await createCampusServiceListing(payload);
      setMessage({ type: 'success', text: `已发布“${values.title}”。` });
      form.resetFields();
      setUploadedImages((current) => {
        current.forEach((item) => {
          if (item.previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(item.previewUrl);
          }
        });
        return [];
      });
      applyPublishStrategy(presetIntent ?? 'REQUEST', 'ONE_TIME');
      void navigate('/campus-services', { state: { selectedListingId: created.id } });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '发布失败，请稍后重试。') });
    } finally {
      setSubmitting(false);
    }
  }

  const rulesGateReady = hasReachedRuleEnd && rulesCountdown === 0;
  const rulesGateButtonLabel = !hasReachedRuleEnd
    ? '请先拉到底'
    : rulesCountdown > 0
      ? `${rulesCountdown}s 后可同意`
      : '已阅读并同意';

  return (
    <div className={variant === 'publish' ? 'publish-workbench-main service-publish-workbench' : 'two-col service-market-layout'}>
      {enableRulesGate ? (
        <Modal
          open={rulesModalOpen}
          closable={false}
          maskClosable={false}
          keyboard={false}
          title="发布规则与服务约束确认"
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
      ) : null}

      <PageCard>
        <SectionHeader title={sectionTitle} className="is-spacious" />
        {message ? <Alert type={message.type} showIcon message={message.text} closable onClose={() => setMessage(null)} style={{ marginBottom: 16 }} /> : null}
        <Form
          form={form}
          layout="vertical"
          onFinish={handlePublish}
          className="form-shell service-market-form"
          initialValues={{
            intent: presetIntent ?? 'REQUEST',
            pattern: 'ONE_TIME',
            priceMode: 'FIXED',
            itemCount: 1,
            urgency: 'NORMAL',
            fulfillmentMode: 'FLEXIBLE',
            maxConcurrentOrders: 1,
            maxTotalOrders: 1,
            autoConfirm: resolveDefaultAutoConfirm(presetIntent ?? 'REQUEST', 'ONE_TIME')
          }}
        >
          <PublishImageManager
            title="服务图片"
            modalTitle={intent === 'OFFER' ? '上传服务展示图片' : '上传需求说明图片'}
            items={uploadedImages}
            uploading={uploadingImage}
            onChange={setUploadedImages}
            onUpload={handleServiceImageUpload}
          />
          <div className="service-market-form-grid">
            {!presetIntent ? (
              <Form.Item name="intent" label="发布方向" initialValue="REQUEST" rules={[{ required: true }]}>
                <Select
                  options={intentOptions}
                  onChange={(nextIntent: CampusServiceIntent) => {
                    applyPublishStrategy(nextIntent, form.getFieldValue('pattern') ?? 'ONE_TIME');
                  }}
                />
              </Form.Item>
            ) : null}
            <Form.Item name="pattern" label="服务模式" initialValue="ONE_TIME" rules={[{ required: true }]}>
              <Select
                options={patternOptions}
                onChange={(nextPattern: CampusServicePattern) => {
                  applyPublishStrategy(intent, nextPattern);
                }}
              />
            </Form.Item>
            <Form.Item name="title" label="任务标题" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="category" label="服务类型" rules={[{ required: true }]}>
              <Select
                options={moduleConfig.map((item) => ({
                  value: item.key,
                  label: item.title
                }))}
              />
            </Form.Item>
            <Form.Item name="priceMode" label="报价方式" initialValue="FIXED" rules={[{ required: true }]}>
              <Select options={priceModeOptions} />
            </Form.Item>
            <Form.Item
              name="reward"
              label="金额 / 报价"
              rules={priceMode === 'FIXED' ? [{ required: true, message: '请输入固定金额' }] : []}
            >
              <InputNumber
                min={priceMode === 'FREE' ? 0 : 1}
                style={{ width: '100%' }}
                prefix="¥"
                disabled={priceMode !== 'FIXED'}
                placeholder={priceMode === 'FIXED' ? '输入固定金额' : '当前无需填写'}
              />
            </Form.Item>
            <Form.Item name="itemCount" label="件数" initialValue={1} rules={[{ required: true }]}>
              <InputNumber min={1} max={20} style={{ width: '100%' }} suffix="件" />
            </Form.Item>
            <Form.Item name="estimatedMinutes" label="预计耗时" rules={[{ required: true }]}>
              <InputNumber min={5} max={180} style={{ width: '100%' }} suffix="分钟" />
            </Form.Item>
            <Form.Item name="urgency" label="紧急程度" initialValue="NORMAL" rules={[{ required: true }]}>
              <Select options={urgencyOptions} />
            </Form.Item>
            <Form.Item name="fulfillmentMode" label="交付方式" initialValue="FLEXIBLE" rules={[{ required: true }]}>
              <Select options={fulfillmentModeOptions} />
            </Form.Item>
            <Form.Item
              name="maxTotalOrders"
              label="总名额上限"
            >
              <InputNumber min={1} max={99} style={{ width: '100%' }} placeholder="不填则不限或按模式默认" />
            </Form.Item>
            <Form.Item
              name="maxConcurrentOrders"
              label="同时进行中上限"
              initialValue={1}
            >
              <InputNumber min={1} max={20} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item
            name="validUntilAt"
            label="有效截止时间"
            rules={[{ required: true }]}
          >
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
              placeholder="选择截止时间"
            />
          </Form.Item>
          <Form.Item name="locationNote" label="地点补充 / 路线说明">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="补充说明" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="trustNote" label="交接备注">
            <Input />
          </Form.Item>
          <Form.Item
            name="autoConfirm"
            label="自动确认成交"
            valuePropName="checked"
            initialValue={resolveDefaultAutoConfirm(presetIntent ?? 'REQUEST', 'ONE_TIME')}
          >
            <Switch />
          </Form.Item>
          <ActionRow>
            <Button type="primary" htmlType="submit" loading={submitting} icon={<PlusOutlined />}>
              立即发布
            </Button>
          </ActionRow>
        </Form>
      </PageCard>
    </div>
  );
}
