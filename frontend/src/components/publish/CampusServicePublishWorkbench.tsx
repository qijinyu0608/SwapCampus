import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Dayjs } from 'dayjs';
import { ActionRow, PageCard, SectionHeader } from '../layout';
import { ThinkingOverlay } from '../feedback';
import { useAuthState } from '../../services/auth-state';
import {
  type CampusServiceCreatePayload,
  type CampusServiceDetailView,
  createCampusServiceListing,
  fetchCampusServiceDetail,
  type CampusServiceFulfillmentMode,
  getApiErrorMessage,
  type CampusServiceIntent,
  type CampusServiceLocationMode,
  type CampusServicePattern,
  type CampusServicePriceMode,
  updateCampusServiceListing,
  uploadImageAsset
} from '../../services/api';
import { hasTradingAccess, isGuestUser } from '../../services/session';
import { PublishImageManager, type PublishImageItem } from './PublishImageManager';

function parsePickerValue(value: Dayjs | string) {
  if (typeof value !== 'string') {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const normalized = value.trim().replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const intentOptions: Array<{ value: CampusServiceIntent; label: string }> = [
  { value: 'REQUEST', label: '我要购买服务' },
  { value: 'OFFER', label: '我要接单挣钱' }
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

const locationModeOptions: Array<{ value: CampusServiceLocationMode; label: string }> = [
  { value: 'ONLINE', label: '线上' },
  { value: 'ON_SITE', label: '线下' },
  { value: 'FLEXIBLE', label: '私聊' }
];

const priceModeOptions: Array<{ value: CampusServicePriceMode; label: string }> = [
  { value: 'FIXED', label: '固定金额' },
  { value: 'NEGOTIABLE', label: '面议' },
  { value: 'FREE', label: '免费' }
];

const MIN_VALID_MINUTES = 30;
const MAX_VALID_DAYS = 30;
const DEFAULT_ESTIMATED_MINUTES = 30;
const DEFAULT_URGENCY = 'NORMAL';

type PublishFormValues = {
  intent: CampusServiceIntent;
  pattern: CampusServicePattern;
  title: string;
  description: string;
  priceMode: CampusServicePriceMode;
  reward?: number;
  locationMode?: CampusServiceLocationMode;
  locationNote?: string;
  validUntilAt: Dayjs | string;
  estimatedMinutes?: number;
  urgency?: 'NORMAL' | 'TODAY' | 'URGENT';
  fulfillmentMode?: CampusServiceFulfillmentMode;
  itemCount?: number;
  maxTotalOrders?: number | null;
  maxConcurrentOrders?: number;
  trustNote?: string;
};

type CampusServicePublishWorkbenchProps = {
  sectionTitle?: string;
  presetIntent?: CampusServiceIntent;
  variant?: 'default' | 'publish';
  enableRulesGate?: boolean;
  listingId?: number;
};

function resolveDefaultMaxTotalOrders(pattern: CampusServicePattern) {
  return pattern === 'ONE_TIME' ? 1 : null;
}

function buildPublishStrategy(intent: CampusServiceIntent, pattern: CampusServicePattern) {
  const maxTotalOrders = resolveDefaultMaxTotalOrders(pattern);

  return {
    maxTotalOrders,
    maxConcurrentOrders: 1
  };
}

function buildEditInitialValues(detail: CampusServiceDetailView): PublishFormValues {
  return {
    intent: detail.intent,
    pattern: detail.pattern,
    title: detail.title,
    description: detail.description,
    priceMode: detail.priceMode,
    reward: detail.priceMode === 'FIXED' ? detail.reward : undefined,
    locationMode: detail.locationMode,
    locationNote: detail.locationNote ?? undefined,
    validUntilAt: detail.fulfillment.validUntilAt.replace('T', ' ').slice(0, 16),
    estimatedMinutes: detail.estimatedMinutes,
    urgency: detail.urgency,
    fulfillmentMode: detail.fulfillment.mode,
    itemCount: detail.itemCount,
    maxTotalOrders: detail.fulfillment.maxTotalOrders,
    maxConcurrentOrders: detail.fulfillment.maxConcurrentOrders ?? 1,
    trustNote: detail.trustNote ?? undefined
  };
}

export function CampusServicePublishWorkbench({
  sectionTitle = '发布服务',
  presetIntent,
  variant = 'default',
  listingId,
}: CampusServicePublishWorkbenchProps) {
  const navigate = useNavigate();
  const { currentUser } = useAuthState();
  const [form] = Form.useForm<PublishFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<PublishImageItem[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editListingIntent, setEditListingIntent] = useState<CampusServiceIntent | null>(null);
  const uploadedImagesRef = useRef<PublishImageItem[]>([]);
  const isEditMode = Number.isFinite(listingId);
  const lockedIntent = presetIntent ?? (isEditMode ? (editListingIntent ?? undefined) : undefined);
  const watchedIntent = Form.useWatch('intent', form);
  const intent = lockedIntent ?? watchedIntent ?? 'REQUEST';
  const pattern = Form.useWatch('pattern', form) ?? 'ONE_TIME';
  const priceMode = Form.useWatch('priceMode', form) ?? 'FIXED';
  const titleLabel = intent === 'REQUEST' ? '求助标题' : '服务标题';
  const amountLabel = intent === 'REQUEST' ? '预算 / 报价' : '收费 / 报价';
  const totalOrdersLabel = intent === 'REQUEST' ? '招募人数上限' : '预约名额上限';
  const concurrentOrdersLabel = intent === 'REQUEST' ? '同时接单上限' : '同时服务上限';
  const submitLabel = isEditMode
    ? '保存修改'
    : intent === 'REQUEST' ? '立即发布求助' : '立即发布服务';

  function applyPublishStrategy(nextIntent: CampusServiceIntent, nextPattern: CampusServicePattern) {
    const nextStrategy = buildPublishStrategy(nextIntent, nextPattern);
    const currentReward = form.getFieldValue('reward');

    form.setFieldsValue({
      intent: lockedIntent ?? nextIntent,
      maxTotalOrders: nextStrategy.maxTotalOrders,
      maxConcurrentOrders: nextStrategy.maxConcurrentOrders,
      priceMode: form.getFieldValue('priceMode') ?? 'FIXED',
      reward: currentReward
    });
  }

  useEffect(() => {
    if (!lockedIntent) {
      return;
    }

    applyPublishStrategy(lockedIntent, form.getFieldValue('pattern') ?? 'ONE_TIME');
  }, [form, lockedIntent]);

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
    if (!isEditMode || !listingId) {
      return;
    }

    let cancelled = false;

    async function loadListing() {
      setLoading(true);
      try {
        const detail = await fetchCampusServiceDetail(listingId!);
        if (cancelled) {
          return;
        }

        const nextItems = (detail.images ?? []).map((url, index) => ({
          key: `existing-${index}-${url}`,
          url,
          previewUrl: url,
          width: 1200,
          height: 1200
        }));

        setUploadedImages((current) => {
          current.forEach((item) => {
            if (item.previewUrl.startsWith('blob:')) {
              URL.revokeObjectURL(item.previewUrl);
            }
          });
          return nextItems;
        });

        setEditListingIntent(detail.intent);
        form.setFieldsValue(buildEditInitialValues(detail));
        setMessage(null);
      } catch (error) {
        if (!cancelled) {
          setMessage({ type: 'error', text: getApiErrorMessage(error, '服务详情加载失败，请稍后重试。') });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadListing();

    return () => {
      cancelled = true;
    };
  }, [form, isEditMode, listingId]);

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
        intent: isEditMode ? (editListingIntent ?? intent) : intent,
        validFromAt: isEditMode ? undefined : now.toISOString(),
        validUntilAt: parsedValidUntilAt.toISOString(),
        amount: values.priceMode === 'FREE' ? 0 : values.reward,
        reward: values.priceMode === 'FREE' ? 0 : values.reward,
        estimatedMinutes: values.estimatedMinutes ?? DEFAULT_ESTIMATED_MINUTES,
        urgency: values.urgency ?? DEFAULT_URGENCY,
        maxTotalOrders: values.maxTotalOrders ?? undefined,
        locationMode: values.locationMode ?? 'FLEXIBLE',
        locationNote: values.locationNote?.trim() || undefined,
        imageUrls: uploadedImages.map((item) => item.url)
      };

      if (values.priceMode !== 'FIXED') {
        delete payload.reward;
      }

      if (isEditMode) {
        delete payload.intent;
        delete payload.validFromAt;
      }

      const saved = isEditMode && listingId
        ? await updateCampusServiceListing(listingId, payload)
        : await createCampusServiceListing(payload);
      setMessage({ type: 'success', text: isEditMode ? `已更新“${values.title}”。` : `已发布“${values.title}”。` });

      if (isEditMode) {
        const nextItems = (saved.images ?? []).map((url, index) => ({
          key: `existing-${index}-${url}`,
          url,
          previewUrl: url,
          width: 1200,
          height: 1200
        }));
        setUploadedImages((current) => {
          current.forEach((item) => {
            if (item.previewUrl.startsWith('blob:')) {
              URL.revokeObjectURL(item.previewUrl);
            }
          });
          return nextItems;
        });
        setEditListingIntent(saved.intent);
        form.setFieldsValue(buildEditInitialValues(saved));
        void navigate(`/campus-services/${saved.id}`, { replace: true });
      } else {
        void navigate(`/campus-services/${saved.id}`, { replace: true });
      }
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, isEditMode ? '保存失败，请稍后重试。' : '发布失败，请稍后重试。') });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={variant === 'publish' ? 'publish-workbench-main service-publish-workbench publish-workbench-shell' : 'two-col service-market-layout'}>
      <ThinkingOverlay open={submitting} />
      <ThinkingOverlay open={loading} />
      <PageCard>
        {variant === 'publish' ? null : <SectionHeader title={sectionTitle} className="is-spacious" />}
        {message ? <Alert type={message.type} showIcon message={message.text} closable onClose={() => setMessage(null)} style={{ marginBottom: 16 }} /> : null}
        <Form
          form={form}
          layout="vertical"
          onFinish={handlePublish}
          className="form-shell service-market-form"
          initialValues={{
            intent: lockedIntent ?? 'REQUEST',
            pattern: 'ONE_TIME',
            priceMode: 'FIXED',
            itemCount: 1,
            locationMode: 'FLEXIBLE',
            fulfillmentMode: 'FLEXIBLE',
            maxConcurrentOrders: 1,
            maxTotalOrders: 1
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
            {!lockedIntent ? (
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
            <Form.Item name="title" label={titleLabel} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="priceMode" label="报价方式" initialValue="FIXED" rules={[{ required: true }]}>
              <Select options={priceModeOptions} />
            </Form.Item>
            <Form.Item
              name="reward"
              label={amountLabel}
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
            <Form.Item name="locationMode" label="联系与交付" initialValue="FLEXIBLE" rules={[{ required: true }]}>
              <Select options={locationModeOptions} />
            </Form.Item>
            <Form.Item name="fulfillmentMode" label="交付方式" initialValue="FLEXIBLE" rules={[{ required: true }]}>
              <Select options={fulfillmentModeOptions} />
            </Form.Item>
            <Form.Item
              name="maxTotalOrders"
              label={totalOrdersLabel}
            >
              <InputNumber min={1} max={99} style={{ width: '100%' }} placeholder="不填则不限或按模式默认" />
            </Form.Item>
            <Form.Item
              name="maxConcurrentOrders"
              label={concurrentOrdersLabel}
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
          <ActionRow>
            <Button type="primary" htmlType="submit" loading={submitting} icon={<PlusOutlined />}>
              {submitLabel}
            </Button>
          </ActionRow>
        </Form>
      </PageCard>
    </div>
  );
}
