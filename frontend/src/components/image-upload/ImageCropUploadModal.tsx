import { UploadOutlined } from '@ant-design/icons';
import { Button, Modal, Slider, message } from 'antd';
import Cropper, { type Area } from 'react-easy-crop';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cropImageToBlob } from './cropImage';

type ImageCropUploadModalProps = {
  open: boolean;
  title: string;
  shape?: 'rect' | 'round';
  aspect?: number;
  outputWidth?: number;
  outputHeight?: number;
  confirmText?: string;
  onCancel: () => void;
  onConfirm: (file: File, previewUrl: string) => Promise<void> | void;
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

function validateImageFile(file: File) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('仅支持 JPG、PNG、WEBP 图片');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('图片大小不能超过 8MB');
  }
}

export function ImageCropUploadModal({
  open,
  title,
  shape = 'rect',
  aspect = 1,
  outputWidth = 512,
  outputHeight,
  confirmText,
  onCancel,
  onConfirm
}: ImageCropUploadModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSourceFile(null);
      setImageSrc('');
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [open]);

  const hasImage = Boolean(imageSrc);
  const cropShape = shape === 'round' ? 'round' : 'rect';
  const previewHint = useMemo(
    () => shape === 'round' ? '将导出为圆形透明背景 PNG' : '将导出为矩形图片',
    [shape]
  );

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      validateImageFile(file);
      const nextSrc = await fileToDataUrl(file);
      setSourceFile(file);
      setImageSrc(nextSrc);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '图片读取失败');
    } finally {
      event.target.value = '';
    }
  }

  async function handleSubmit() {
    if (!sourceFile || !imageSrc || !croppedAreaPixels) {
      message.error('请先选择并裁剪图片');
      return;
    }

    setSubmitting(true);
    try {
      const blob = await cropImageToBlob({
        imageSrc,
        cropArea: croppedAreaPixels,
        outputWidth,
        outputHeight,
        circular: shape === 'round',
        mimeType: shape === 'round' ? 'image/png' : sourceFile.type
      });
      const extension = shape === 'round'
        ? 'png'
        : sourceFile.type === 'image/png'
          ? 'png'
          : sourceFile.type === 'image/webp'
            ? 'webp'
            : 'jpg';
      const croppedFile = new File([blob], `crop-${Date.now()}.${extension}`, { type: blob.type });
      const previewUrl = URL.createObjectURL(blob);
      await onConfirm(croppedFile, previewUrl);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '图片处理失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      onOk={() => void handleSubmit()}
      okText={confirmText ?? (shape === 'round' ? '保存头像' : '保存图片')}
      cancelText="取消"
      confirmLoading={submitting}
      className="image-crop-modal"
      width={720}
      destroyOnHidden
    >
      <div className="image-crop-shell">
        <div className="image-crop-toolbar">
          <Button icon={<UploadOutlined />} onClick={() => inputRef.current?.click()}>
            选择图片
          </Button>
          <span>{previewHint}</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={handleFileChange}
          />
        </div>

        <div className="image-crop-stage">
          {hasImage ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
            />
          ) : (
            <div className="image-crop-empty">选择一张图片后在这里裁剪</div>
          )}
        </div>

        <div className="image-crop-zoom-row">
          <span>缩放</span>
          <Slider
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(value) => setZoom(typeof value === 'number' ? value : 1)}
            disabled={!hasImage}
          />
        </div>
      </div>
    </Modal>
  );
}
