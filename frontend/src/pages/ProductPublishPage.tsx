import { Alert, Button, Form, Input, InputNumber, Slider, message as antMessage } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ActionRow, SectionHeader } from '../components/layout';
import { ThinkingOverlay } from '../components/feedback';
import { CampusServicePublishWorkbench, PublishImageManager, type PublishImageItem } from '../components/publish';
import { ConfirmActionModal, SectionCard } from '../components/ui';
import {
  formatProductConditionValue,
  parseProductConditionValue,
  PRODUCT_CONDITION_MAX,
  PRODUCT_CONDITION_MIN,
  PRODUCT_CONDITION_STEP
} from '../constants/productConditions';
import { useAuthState } from '../services/auth-state';
import { fetchProductDetail, fetchPublishingRules, getApiErrorMessage, type PublishingRules } from '../services/api';
import {
  createProductWithImages,
  type ProductPublishPayload,
  type ProductPublishReview,
  updateProductWithImages,
  uploadProductImageAsset
} from '../services/product-publish';
import { hasTradingAccess, isGuestUser } from '../services/session';

type PublishType = 'product' | 'service-request' | 'service-offer';

type ProductPublishFormValues = {
  title: string;
  conditionValue: number;
  price: number;
  description: string;
};

export function ProductPublishPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuthState();
  const [form] = Form.useForm<ProductPublishFormValues>();
  const [publishType, setPublishType] = useState<PublishType>('product');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [rules, setRules] = useState<PublishingRules | null>(null);
  const [uploadedImages, setUploadedImages] = useState<PublishImageItem[]>([]);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [pendingPriceReview, setPendingPriceReview] = useState<{
    payload: ProductPublishPayload;
    review: ProductPublishReview;
  } | null>(null);
  const uploadedImagesRef = useRef<PublishImageItem[]>([]);
  const isEditMode = Boolean(id);

  useEffect(() => {
    fetchPublishingRules().then(setRules).catch(() => setRules(null));
  }, []);

  useEffect(() => {
    if (!isEditMode || !id) {
      return;
    }

    let cancelled = false;

    async function loadProduct() {
      setLoadingProduct(true);
      try {
        const detail = await fetchProductDetail(Number(id));
        if (cancelled) {
          return;
        }

        const parsedCondition = parseProductConditionValue(detail.condition) ?? PRODUCT_CONDITION_MAX;
        const nextItems = detail.images.map((url, index) => ({
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
        form.setFieldsValue({
          title: detail.title,
          price: detail.price,
          description: detail.description,
          conditionValue: parsedCondition
        });
        setMessage(null);
      } catch (error) {
        if (!cancelled) {
          setMessage({ type: 'error', text: getApiErrorMessage(error, '商品详情加载失败，请稍后重试。') });
        }
      } finally {
        if (!cancelled) {
          setLoadingProduct(false);
        }
      }
    }

    void loadProduct();

    return () => {
      cancelled = true;
    };
  }, [form, id, isEditMode]);

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

  async function publishProduct(payload: ProductPublishPayload, options?: { skipImageCheck?: boolean }) {
    if (!hasTradingAccess(currentUser)) {
      setMessage({ type: 'error', text: isGuestUser(currentUser) ? '浏览账号不可发布商品。' : '请先登录后再发布商品。' });
      return;
    }

    if (!options?.skipImageCheck && !uploadedImages.length) {
      setMessage({ type: 'error', text: '请至少上传 1 张商品图片。' });
      antMessage.error('请至少上传 1 张商品图片');
      return;
    }

    setSubmittingProduct(true);
    try {
      const result = isEditMode && id
        ? await updateProductWithImages(Number(id), payload)
        : await createProductWithImages(payload);

      setMessage({ type: 'success', text: isEditMode ? `商品已更新：${result.title}` : `商品已提交：${result.title}（ID ${result.id}，状态 ${result.status}）` });
      setPendingPriceReview(null);
      void navigate(`/products/${result.id}`, { replace: true });
    } catch (error) {
      const maybePayload = typeof error === 'object' && error && 'response' in error
        ? (error as {
            response?: {
              data?: {
                code?: string;
                review?: ProductPublishReview;
              };
            };
          }).response?.data
        : null;

      if (maybePayload?.code === 'PRICE_CONFIRMATION_REQUIRED' && maybePayload.review?.priceReview?.requiresConfirmation) {
        setPendingPriceReview({
          payload,
          review: maybePayload.review
        });
        setMessage(null);
        return;
      }

      setMessage({
        type: 'error',
        text: getApiErrorMessage(error, isEditMode ? '保存失败，请稍后重试。' : '发布失败，请稍后重试。')
      });
    } finally {
      setSubmittingProduct(false);
    }
  }

  async function handleSubmit(values: ProductPublishFormValues) {
    const payload: ProductPublishPayload = {
      title: values.title,
      description: values.description,
      price: values.price,
      condition: formatProductConditionValue(values.conditionValue),
      tags: [],
      imageUrls: uploadedImages.map((item) => item.url)
    };

    await publishProduct(payload);
  }

  async function handleConfirmPriceReview() {
    if (!pendingPriceReview) {
      return;
    }

    await publishProduct({
      ...pendingPriceReview.payload,
      confirmPriceReview: true
    }, { skipImageCheck: true });
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

  const isProductPublish = publishType === 'product';
  const servicePresetIntent = publishType === 'service-offer' ? 'OFFER' : 'REQUEST';
  const publishTypeOptions: Array<{
    key: PublishType;
    title: string;
  }> = [
    {
      key: 'product',
      title: '发布商品'
    },
    {
      key: 'service-request',
      title: '我要购买服务'
    },
    {
      key: 'service-offer',
      title: '我要接单挣钱'
    }
  ];

  return (
    <div id="publish-top" className="page-grid publish-page publish-workbench-page">
      <div className="publish-layout">
        {isEditMode ? null : (
          <section className="publish-type-panel">
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
                  <strong>{option.title}</strong>
                </button>
              ))}
            </div>
          </section>
        )}

        {isProductPublish ? (
          <div className="publish-workbench-main publish-workbench-shell">
            <ThinkingOverlay open={submittingProduct} />
            <ThinkingOverlay open={loadingProduct} />
            <SectionCard
              className="publish-main-card publish-editor-card"
              title={<SectionHeader title={isEditMode ? '编辑商品' : '商品信息'} className="is-prominent" />}
            >
              {message ? <Alert style={{ marginBottom: 16 }} type={message.type} showIcon message={message.text} /> : null}
              <Form
                form={form}
                layout="vertical"
                onFinish={(values) => void handleSubmit(values)}
                className="form-shell publish-form"
                initialValues={{ conditionValue: PRODUCT_CONDITION_MAX }}
              >
                <PublishImageManager
                  title="商品图片"
                  modalTitle="上传商品图片"
                  items={uploadedImages}
                  uploading={uploadingImage}
                  onChange={setUploadedImages}
                  onUpload={handleProductImageUpload}
                />

                <div className="publish-form-grid">
                  <Form.Item
                    name="title"
                    label="商品标题"
                    rules={[{ required: true, message: '请输入商品标题' }]}
                  >
                    <Input placeholder="例如：九成计算机网络教材" maxLength={40} showCount />
                  </Form.Item>
                  <Form.Item
                    name="conditionValue"
                    label="商品成色"
                    rules={[{ required: true, message: '请选择商品成色' }]}
                  >
                    <Slider
                      min={PRODUCT_CONDITION_MIN}
                      max={PRODUCT_CONDITION_MAX}
                      step={PRODUCT_CONDITION_STEP}
                      marks={{
                        [PRODUCT_CONDITION_MIN]: '00',
                        [PRODUCT_CONDITION_MAX]: '10'
                      }}
                      tooltip={{ formatter: (value) => formatProductConditionValue(value ?? PRODUCT_CONDITION_MIN) }}
                    />
                  </Form.Item>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, next) => prev.conditionValue !== next.conditionValue}
                  >
                    {() => (
                      <div className="publish-form-span-2" style={{ marginTop: -8, marginBottom: 8 }}>
                        当前成色：{formatProductConditionValue(form.getFieldValue('conditionValue') ?? PRODUCT_CONDITION_MAX)}
                      </div>
                    )}
                  </Form.Item>
                  <Form.Item
                    name="price"
                    label="价格"
                    rules={[{ required: true, message: '请输入价格' }]}
                  >
                    <InputNumber min={0} style={{ width: '100%' }} controls={false} prefix="¥" placeholder="88" />
                  </Form.Item>
                  <div className="publish-form-span-2 publish-description-group">
                    <Form.Item
                      name="description"
                      label="描述"
                      rules={[{ required: true, message: '请输入商品描述' }]}
                    >
                      <Input.TextArea rows={7} placeholder="写清使用情况、配件、容量/版本、可交易地点。" maxLength={240} showCount />
                    </Form.Item>
                  </div>
                </div>

                <ActionRow className="publish-submit-row">
                  <Button type="primary" htmlType="submit" loading={submittingProduct}>{isEditMode ? '保存修改' : '发布商品'}</Button>
                </ActionRow>
              </Form>
            </SectionCard>
            <ConfirmActionModal
              open={Boolean(pendingPriceReview)}
              title="价格可能不太合理"
              confirmText={isEditMode ? '继续保存' : '继续发布'}
              cancelText="返回修改"
              loading={submittingProduct}
              onConfirm={() => void handleConfirmPriceReview()}
              onCancel={() => setPendingPriceReview(null)}
              description={pendingPriceReview ? (
                <div className="publish-price-review-dialog">
                  <p>{pendingPriceReview.review.priceReview?.reason ?? pendingPriceReview.review.reason}</p>
                  <div className="publish-price-review-meta">
                    <span>当前价格：¥{pendingPriceReview.payload.price}</span>
                    <span>
                      建议区间：
                      {' '}
                      {pendingPriceReview.review.priceReview?.suggestedPriceMin ?? '--'}
                      {' - '}
                      {pendingPriceReview.review.priceReview?.suggestedPriceMax ?? '--'}
                    </span>
                    <span>
                      判断方向：
                      {pendingPriceReview.review.priceReview?.verdict === 'HIGH' ? '可能偏高' : '可能偏低'}
                    </span>
                  </div>
                </div>
              ) : ''}
            />
          </div>
        ) : (
          <CampusServicePublishWorkbench
            sectionTitle={publishType === 'service-offer' ? '发布可预约服务' : '发布服务需求'}
            presetIntent={servicePresetIntent}
            variant="publish"
            enableRulesGate={false}
            listingId={undefined}
          />
        )}
      </div>
    </div>
  );
}
