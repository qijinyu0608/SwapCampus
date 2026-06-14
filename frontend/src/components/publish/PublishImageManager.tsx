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
import { Button, message as antMessage } from 'antd';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ImageCropUploadModal } from '../image-upload';
import { SectionHeader } from '../layout';

export type PublishImageItem = {
  key: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
};

type UploadedImageAsset = {
  objectKey: string;
  url: string;
  width: number;
  height: number;
};

type DragOverlaySize = {
  width: number;
  height: number;
};

type PublishImageManagerProps = {
  title: string;
  uploadText?: string;
  modalTitle: string;
  confirmText?: string;
  emptyHint?: string;
  maxImages?: number;
  items: PublishImageItem[];
  uploading?: boolean;
  onChange: (items: PublishImageItem[]) => void;
  onUpload: (file: File) => Promise<UploadedImageAsset>;
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
  item: PublishImageItem;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
};

function PublishImageTileBody({ item, index, onEdit, onRemove }: PublishImageTileBodyProps) {
  return (
    <>
      <img src={item.previewUrl} alt={`发布图片 ${index + 1}`} />
      <div className="publish-image-topbar">
        {index === 0 ? <span className="publish-image-cover-badge">封面</span> : null}
        <div className="publish-image-actions">
          <button
            type="button"
            className="publish-image-action"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onEdit}
            aria-label={`编辑发布图片 ${index + 1}`}
          >
            <ImageEditIcon />
          </button>
          <button
            type="button"
            className="publish-image-action is-danger"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onRemove}
            aria-label={`删除发布图片 ${index + 1}`}
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

function SortablePublishImageTile({ item, index, onEdit, onRemove }: PublishImageTileBodyProps) {
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

export function PublishImageManager({
  title,
  uploadText = '添加图片',
  modalTitle,
  confirmText = '保存图片',
  emptyHint,
  maxImages = 6,
  items,
  uploading = false,
  onChange,
  onUpload
}: PublishImageManagerProps) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [activeImageKey, setActiveImageKey] = useState<string | null>(null);
  const [dragOverlaySize, setDragOverlaySize] = useState<DragOverlaySize | null>(null);
  const itemsRef = useRef<PublishImageItem[]>([]);
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

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => () => {
    itemsRef.current.forEach((item) => {
      if (item.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
  }, []);

  async function handleImageConfirm(file: File, previewUrl: string) {
    if (items.length >= maxImages) {
      URL.revokeObjectURL(previewUrl);
      antMessage.error(`最多上传 ${maxImages} 张图片`);
      return;
    }

    try {
      const uploaded = await onUpload(file);
      onChange([
        ...items,
        {
          key: uploaded.objectKey,
          url: uploaded.url,
          previewUrl,
          width: uploaded.width,
          height: uploaded.height
        }
      ]);
      setUploadModalOpen(false);
      antMessage.success('图片已上传');
    } catch (error) {
      URL.revokeObjectURL(previewUrl);
      throw error;
    }
  }

  function handleRemoveImage(key: string) {
    onChange(items.filter((item) => {
      if (item.key === key && item.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return item.key !== key;
    }));
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
      onChange(arrayMove(
        items,
        items.findIndex((item) => item.key === active.id),
        items.findIndex((item) => item.key === over.id)
      ));
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

  const activeDraggedImage = activeImageKey ? items.find((item) => item.key === activeImageKey) ?? null : null;
  const activeDraggedImageIndex = activeDraggedImage ? items.findIndex((item) => item.key === activeDraggedImage.key) : -1;

  return (
    <>
      <div className="publish-media-section">
        <SectionHeader
          title={title}
          aside={(
            <Button
              type="default"
              icon={<PlusOutlined />}
              onClick={() => setUploadModalOpen(true)}
              disabled={items.length >= maxImages || uploading}
            >
              {uploading ? '上传中' : uploadText}
            </Button>
          )}
        />
        <div className={`publish-image-stage${items.length ? '' : ' is-empty'}`}>
          {items.length ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleImageDragStart}
              onDragEnd={handleImageDragEnd}
              onDragCancel={handleImageDragCancel}
            >
              <SortableContext items={items.map((item) => item.key)} strategy={rectSortingStrategy}>
                <div className="publish-image-grid" aria-label={`${title}排序区`}>
                  {items.map((item, index) => (
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
            <div className="publish-image-empty-state" aria-live="polite">
              {emptyHint ? <span className="publish-image-empty-hint">{emptyHint}</span> : null}
            </div>
          )}
        </div>
      </div>

      <ImageCropUploadModal
        open={uploadModalOpen}
        title={modalTitle}
        shape="rect"
        aspect={1}
        outputWidth={1200}
        outputHeight={1200}
        confirmText={confirmText}
        onCancel={() => setUploadModalOpen(false)}
        onConfirm={handleImageConfirm}
      />
    </>
  );
}
