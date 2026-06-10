import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Form, Input, InputNumber, Modal, Select, message as antMessage } from 'antd';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ImageCropUploadModal } from '../components/image-upload';
import { ActionRow, InlineMeta, SectionHeader } from '../components/layout';
import {
  defaultAllowedCategories,
  defaultCommunityNotices,
  defaultDormElectricalWhitelist,
  defaultProhibitedKeywords,
  defaultReviewFlow,
  defaultRuleHighlights,
  defaultTrustSignals,
  PublishRulesDocument
} from '../components/product';
import { SectionCard } from '../components/ui';
import { PRODUCT_CONDITION_VALUES } from '../constants/productConditions';
import { useAuthState } from '../services/auth-state';
import { fetchPublishingRules, getApiErrorMessage, type PublishingRules } from '../services/api';
import { createProductWithImages, uploadProductImageAsset } from '../services/product-publish';
import { hasTradingAccess, isGuestUser } from '../services/session';

const PUBLISH_RULES_STORAGE_KEY = 'swapcampus:publish-rules-dismiss-until';
const PUBLISH_RULES_SUPPRESS_DAYS = 7;
const PUBLISH_RULES_WAIT_SECONDS = 8;
const MAX_PRODUCT_IMAGES = 6;

type ProductPublishFormValues = {
  title: string;
  category: string;
  price: number;
  condition: string;
  description: string;
  tags?: string;
};

type UploadedProductImage = {
  key: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
};

type DragOverlaySize = {
  width: number;
  height: number;
};

function ImageEditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 20h4.5L18.6 9.9a1.5 1.5 0 0 0 0-2.1l-2.4-2.4a1.5 1.5 0 0 0-2.1 0L4 15.5V20Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.8 6.8 17.2 11.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ImageDeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M5 7.5h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M9 7.5V5.8c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3v1.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.3 9.5v8.1c0 1 .8 1.8 1.8 1.8h3.8c1 0 1.8-.8 1.8-1.8V9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.4 11.4v5.3M13.6 11.4v5.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

type PublishImageTileBodyProps = {
  item: UploadedProductImage;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
};

function PublishImageTileBody({ item, index, onEdit, onRemove }: PublishImageTileBodyProps) {
  return (
    <>
      <img src={item.previewUrl} alt={`商品图片 ${index + 1}`} />
      <div className="publish-image-topbar">
        {index === 0 ? <span className="publish-image-cover-badge">封面</span> : null}
        <div className="publish-image-actions">
          <button
            type="button"
            className="publish-image-action"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onEdit}
            aria-label={`编辑商品图片 ${index + 1}`}
          >
            <ImageEditIcon />
          </button>
          <button
            type="button"
            className="publish-image-action is-danger"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onRemove}
            aria-label={`删除商品图片 ${index + 1}`}
          >
            <ImageDeleteIcon />
          </button>
        </div>
      </div>
    </>
  );
}

type StaticPublishImageTileProps = PublishImageTileBodyProps & {
  className?: string;
  style?: CSSProperties;
};

function StaticPublishImageTile({ item, index, onEdit, onRemove, className, style }: StaticPublishImageTileProps) {
  return (
    <div className={['publish-image-tile is-filled', className].filter(Boolean).join(' ')} style={style}>
      <PublishImageTileBody item={item} index={index} onEdit={onEdit} onRemove={onRemove} />
    </div>
  );
}

type SortablePublishImageTileProps = PublishImageTileBodyProps;

function SortablePublishImageTile({ item, index, onEdit, onRemove }: SortablePublishImageTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
    transition: {
      duration: 220,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
    }
  });

  return (
    <div
      ref={setNodeRef}
      className={['publish-image-tile is-filled', isDragging ? 'is-dragging' : ''].filter(Boolean).join(' ')}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 2 : undefined
      }}
      {...attributes}
      {...listeners}
    >
      <PublishImageTileBody item={item} index={index} onEdit={onEdit} onRemove={onRemove} />
    </div>
  );
}

function buildPublishTags(values: {
  title: string;
  category: string;
  condition: string;
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
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [rules, setRules] = useState<PublishingRules | null>(null);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rememberRulesChoice, setRememberRulesChoice] = useState(false);
  const [hasReachedRuleEnd, setHasReachedRuleEnd] = useState(false);
  const [rulesCountdown, setRulesCountdown] = useState(PUBLISH_RULES_WAIT_SECONDS);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedProductImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [activeImageKey, setActiveImageKey] = useState<string | null>(null);
  const [dragOverlaySize, setDragOverlaySize] = useState<DragOverlaySize | null>(null);
  const rulesScrollRef = useRef<HTMLDivElement | null>(null);
  const uploadedImagesRef = useRef<UploadedProductImage[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const allowedCategories = rules?.allowedCategories ?? defaultAllowedCategories;
  const dormElectricalWhitelist = rules?.dormElectricalWhitelist ?? defaultDormElectricalWhitelist;
  const communityNotices = rules?.communityNotices ?? defaultCommunityNotices;
  const ruleHighlights = rules?.ruleHighlights ?? defaultRuleHighlights;
  const prohibitedKeywords = rules?.prohibitedKeywords ?? defaultProhibitedKeywords;
  const reviewFlow = rules?.reviewFlow ?? defaultReviewFlow;
  const trustSignals = rules?.trustSignals ?? defaultTrustSignals;

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

  async function handleSubmit(values: ProductPublishFormValues) {
    if (!hasTradingAccess(currentUser)) {
      setMessage({ type: 'error', text: isGuestUser(currentUser) ? '浏览账号不可发布商品。' : '请先登录后再发布商品。' });
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
        condition: values.condition,
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

  async function handleProductImageConfirm(file: File, previewUrl: string) {
    if (uploadedImages.length >= MAX_PRODUCT_IMAGES) {
      URL.revokeObjectURL(previewUrl);
      antMessage.error(`最多上传 ${MAX_PRODUCT_IMAGES} 张商品图`);
      return;
    }

    setUploadingImage(true);
    try {
      const uploaded = await uploadProductImageAsset(file);
      setUploadedImages((current) => [
        ...current,
        {
          key: uploaded.objectKey,
          url: uploaded.url,
          previewUrl,
          width: uploaded.width,
          height: uploaded.height
        }
      ]);
      setUploadModalOpen(false);
      antMessage.success('商品图片已上传');
    } catch (error) {
      URL.revokeObjectURL(previewUrl);
      antMessage.error(getApiErrorMessage(error, '商品图片上传失败'));
    } finally {
      setUploadingImage(false);
    }
  }

  function handleRemoveImage(key: string) {
    setUploadedImages((current) => {
      const target = current.find((item) => item.key === key);
      if (target?.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.key !== key);
    });
  }

  function handleImageDragStart(event: DragStartEvent) {
    setActiveImageKey(String(event.active.id));
    const initialRect = event.active.rect.current.initial;
    setDragOverlaySize(
      initialRect
        ? {
            width: initialRect.width,
            height: initialRect.height
          }
        : null
    );
  }

  function handleImageDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setUploadedImages((current) => {
        const oldIndex = current.findIndex((item) => item.key === active.id);
        const newIndex = current.findIndex((item) => item.key === over.id);

        if (oldIndex === -1 || newIndex === -1) {
          return current;
        }

        return arrayMove(current, oldIndex, newIndex);
      });
    }

    setActiveImageKey(null);
    setDragOverlaySize(null);
  }

  function handleImageDragCancel() {
    setActiveImageKey(null);
    setDragOverlaySize(null);
  }

  function handleImageEditPlaceholder() {
    antMessage.info('图片编辑功能暂未开放');
  }

  const rulesGateReady = hasReachedRuleEnd && rulesCountdown === 0;
  const rulesGateButtonLabel = !hasReachedRuleEnd
    ? '请先拉到底'
    : rulesCountdown > 0
      ? `${rulesCountdown}s 后可同意`
      : '已阅读并同意';
  const activeDraggedImage = activeImageKey ? uploadedImages.find((item) => item.key === activeImageKey) ?? null : null;
  const activeDraggedImageIndex = activeDraggedImage ? uploadedImages.findIndex((item) => item.key === activeDraggedImage.key) : -1;

  return (
    <div id="publish-top" className="page-grid publish-page publish-workbench-page">
      <Modal
        title="发布规则确认"
        open={rulesModalOpen}
        closable={false}
        maskClosable={false}
        keyboard={false}
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
          />
        </div>
      </Modal>

      <div className="publish-layout">
        <div className="publish-workbench-main">
          <SectionCard
            className="publish-main-card publish-editor-card"
            title={<SectionHeader title="商品信息" description="按真实状态填写标题、价格、成色与说明。" className="is-prominent" />}
            extra={<InlineMeta>发布后默认进入审核</InlineMeta>}
          >
            {message ? <Alert style={{ marginBottom: 16 }} type={message.type} showIcon message={message.text} /> : null}
            <Form form={form} layout="vertical" onFinish={(values) => void handleSubmit(values)} className="form-shell publish-form">
              <div className="publish-media-section">
                <SectionHeader
                  title="商品图片"
                  aside={(
                    <Button
                      type="default"
                      icon={<PlusOutlined />}
                      onClick={() => setUploadModalOpen(true)}
                      disabled={uploadedImages.length >= MAX_PRODUCT_IMAGES || uploadingImage}
                    >
                      {uploadingImage ? '上传中' : '添加图片'}
                    </Button>
                  )}
                />
                <div className={`publish-image-stage${uploadedImages.length ? '' : ' is-empty'}`}>
                  {uploadedImages.length ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleImageDragStart}
                      onDragEnd={handleImageDragEnd}
                      onDragCancel={handleImageDragCancel}
                    >
                      <SortableContext items={uploadedImages.map((item) => item.key)} strategy={rectSortingStrategy}>
                        <div className="publish-image-grid" aria-label="商品图片排序区">
                          {uploadedImages.map((item, index) => (
                            <SortablePublishImageTile
                              key={item.key}
                              item={item}
                              index={index}
                              onEdit={handleImageEditPlaceholder}
                              onRemove={() => handleRemoveImage(item.key)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
                        {activeDraggedImage ? (
                          <StaticPublishImageTile
                            item={activeDraggedImage}
                            index={activeDraggedImageIndex}
                            onEdit={() => undefined}
                            onRemove={() => undefined}
                            className="is-overlay"
                            style={dragOverlaySize ?? undefined}
                          />
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                  ) : (
                    <div className="publish-image-empty-state" aria-live="polite" />
                  )}
                </div>
              </div>

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
                <Form.Item name="condition" label="成色" rules={[{ required: true, message: '请选择成色' }]}>
                  <Select options={PRODUCT_CONDITION_VALUES.map((value) => ({ value }))} placeholder="请选择成色" />
                </Form.Item>
                <div className="publish-form-span-2 publish-description-group">
                  <Form.Item name="description" label="描述" rules={[{ required: true, message: '请输入商品描述' }]}>
                    <Input.TextArea rows={7} placeholder="写清使用情况、配件、容量/版本、可交易地点。" maxLength={240} showCount />
                  </Form.Item>
                </div>
              </div>

              <div className="publish-subsection">
                <SectionHeader title="补充信息" description="标签会用于搜索和推荐，不填也可发布。" />
                <Form.Item name="tags" label="标签">
                  <Input placeholder="例如：教材, 考试周, 可验货" />
                </Form.Item>
              </div>

              <ActionRow
                className="publish-submit-row"
                leading={<InlineMeta>{uploadedImages.length ? `已上传 ${uploadedImages.length} 张商品图，首张将作为封面` : '建议至少上传一张商品图'}</InlineMeta>}
              >
                <Button type="primary" htmlType="submit" loading={submittingProduct}>发布商品</Button>
              </ActionRow>
            </Form>
          </SectionCard>
        </div>
      </div>

      <div className="publish-rules-link-row">
        <Link className="publish-rules-anchor" to="/publish/rules">查看商品发布规则</Link>
      </div>

      <ImageCropUploadModal
        open={uploadModalOpen}
        title="上传商品图片"
        shape="rect"
        aspect={1}
        outputWidth={1200}
        outputHeight={1200}
        confirmText="保存图片"
        onCancel={() => setUploadModalOpen(false)}
        onConfirm={handleProductImageConfirm}
      />
    </div>
  );
}
