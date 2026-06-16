import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageCropUploadModal } from './ImageCropUploadModal';
import { ImageCropUploadModal as ReExportedImageCropUploadModal } from '.';

const mocks = vi.hoisted(() => ({
  cropImageToBlob: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  lastCropperProps: null as any
}));

vi.mock('@ant-design/icons', () => ({
  UploadOutlined: () => <span>UPLOAD_ICON</span>
}));

vi.mock('antd', () => {
  const Modal = ({
    open,
    title,
    onCancel,
    onOk,
    okText = '确认',
    cancelText = '取消',
    confirmLoading,
    className,
    width,
    children
  }: any) => {
    if (!open) {
      return null;
    }

    return (
      <div
        role="dialog"
        className={className}
        data-width={String(width ?? '')}
        data-loading={confirmLoading ? 'true' : 'false'}
      >
        <h2>{title}</h2>
        <div>{children}</div>
        <button type="button" onClick={onOk}>{okText}</button>
        <button type="button" onClick={onCancel}>{cancelText}</button>
      </div>
    );
  };

  const Button = ({ children, icon, onClick, disabled }: any) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {icon}
      {children}
    </button>
  );

  const Slider = ({ value, onChange, disabled }: any) => (
    <input
      aria-label="zoom-slider"
      type="range"
      min="1"
      max="3"
      step="0.05"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange?.(Number(event.target.value))}
    />
  );

  return {
    Modal,
    Button,
    Slider,
    message: {
      success: mocks.success,
      error: mocks.error
    }
  };
});

vi.mock('react-easy-crop', () => ({
  default: (props: any) => {
    mocks.lastCropperProps = props;
    return <div data-testid="cropper">{props.cropShape}</div>;
  }
}));

vi.mock('./cropImage', () => ({
  cropImageToBlob: (...args: any[]) => mocks.cropImageToBlob(...args)
}));

describe('image upload components', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.lastCropperProps = null;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:mock-preview')
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn()
    });
  });

  it('re-exports ImageCropUploadModal from the barrel file', () => {
    expect(ReExportedImageCropUploadModal).toBe(ImageCropUploadModal);
  });

  it('resets state when the modal closes and validates required crop data before submit', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <ImageCropUploadModal
        open
        title="上传封面"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('选择一张图片后在这里裁剪')).toBeInTheDocument();
    expect(screen.getByText('将导出为矩形图片')).toBeInTheDocument();
    expect(screen.getByLabelText('zoom-slider')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '保存图片' }));
    expect(mocks.error).toHaveBeenCalledWith('请先选择并裁剪图片');

    rerender(
      <ImageCropUploadModal
        open={false}
        title="上传封面"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('loads a valid image, updates crop state, crops it and submits the generated file', async () => {
    const onConfirm = vi.fn();
    const blob = new Blob(['cropped'], { type: 'image/png' });
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:preview-url');
    const fileReaderReadAsDataURL = vi
      .spyOn(FileReader.prototype, 'readAsDataURL')
      .mockImplementation(function mockRead(this: FileReader) {
        Object.defineProperty(this, 'result', {
          configurable: true,
          value: 'data:image/png;base64,source-image'
        });
        this.onload?.(new ProgressEvent('load'));
      });

    mocks.cropImageToBlob.mockResolvedValue(blob);

    render(
      <ImageCropUploadModal
        open
        title="上传头像"
        shape="round"
        aspect={1}
        outputWidth={256}
        outputHeight={256}
        confirmText="保存头像"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    if (!input) {
      throw new Error('file input not found');
    }

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(input, {
      target: {
        files: [file]
      }
    });

    expect(await screen.findByTestId('cropper')).toHaveTextContent('round');
    await waitFor(() => {
      expect(mocks.lastCropperProps).toBeTruthy();
    });
    expect(screen.getByText('将导出为圆形透明背景 PNG')).toBeInTheDocument();
    expect(screen.getByLabelText('zoom-slider')).not.toBeDisabled();
    expect(mocks.lastCropperProps.image).toBe('data:image/png;base64,source-image');
    expect(mocks.lastCropperProps.aspect).toBe(1);
    expect(mocks.lastCropperProps.cropShape).toBe('round');

    fireEvent.change(screen.getByLabelText('zoom-slider'), { target: { value: '1.75' } });
    expect((screen.getByLabelText('zoom-slider') as HTMLInputElement).value).toBe('1.75');

    await act(async () => {
      mocks.lastCropperProps.onCropComplete({}, { x: 12, y: 18, width: 120, height: 120 });
    });

    fireEvent.click(screen.getByRole('button', { name: '保存头像' }));

    await waitFor(() => {
      expect(mocks.cropImageToBlob).toHaveBeenCalledWith({
        imageSrc: 'data:image/png;base64,source-image',
        cropArea: { x: 12, y: 18, width: 120, height: 120 },
        outputWidth: 256,
        outputHeight: 256,
        circular: true,
        mimeType: 'image/png'
      });
    });

    expect(createObjectUrlSpy).toHaveBeenCalledWith(blob);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [submittedFile, previewUrl] = onConfirm.mock.calls[0] as [File, string];
    expect(submittedFile).toBeInstanceOf(File);
    expect(submittedFile.name.endsWith('.png')).toBe(true);
    expect(previewUrl).toBe('blob:preview-url');
    expect(fileReaderReadAsDataURL).toHaveBeenCalled();

    createObjectUrlSpy.mockRestore();
    fileReaderReadAsDataURL.mockRestore();
  });

  it('rejects invalid images and reports crop failures', async () => {
    const readAsDataUrlSpy = vi
      .spyOn(FileReader.prototype, 'readAsDataURL')
      .mockImplementation(function mockRead(this: FileReader) {
        Object.defineProperty(this, 'result', {
          configurable: true,
          value: 'data:image/jpeg;base64,source-image'
        });
        this.onload?.(new ProgressEvent('load'));
      });

    render(
      <ImageCropUploadModal
        open
        title="上传封面"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    if (!input) {
      throw new Error('file input not found');
    }

    const invalidTypeFile = new File(['bad'], 'avatar.gif', { type: 'image/gif' });
    fireEvent.change(input, {
      target: {
        files: [invalidTypeFile]
      }
    });
    expect(mocks.error).toHaveBeenCalledWith('仅支持 JPG、PNG、WEBP 图片');

    const oversizedFile = new File(['big'], 'big.png', { type: 'image/png' });
    Object.defineProperty(oversizedFile, 'size', {
      configurable: true,
      value: 8 * 1024 * 1024 + 1
    });
    fireEvent.change(input, {
      target: {
        files: [oversizedFile]
      }
    });
    expect(mocks.error).toHaveBeenCalledWith('图片大小不能超过 8MB');

    const validFile = new File(['cover'], 'cover.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, {
      target: {
        files: [validFile]
      }
    });
    expect(await screen.findByTestId('cropper')).toHaveTextContent('rect');
    await waitFor(() => {
      expect(mocks.lastCropperProps).toBeTruthy();
    });

    await act(async () => {
      mocks.lastCropperProps.onCropComplete({}, { x: 0, y: 0, width: 100, height: 100 });
    });
    mocks.cropImageToBlob.mockRejectedValue(new Error('裁剪失败'));

    fireEvent.click(screen.getByRole('button', { name: '保存图片' }));

    await waitFor(() => {
      expect(mocks.error).toHaveBeenCalledWith('裁剪失败');
    });

    readAsDataUrlSpy.mockRestore();
  });

  it('crops raw images into blobs and reports browser limitations', async () => {
    const { cropImageToBlob: actualCropImageToBlob } = await vi.importActual<typeof import('./cropImage')>('./cropImage');
    const originalImage = globalThis.Image;
    const originalCreateElement = document.createElement.bind(document);

    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | ((error: unknown) => void) = null;

      set src(_value: string) {
        this.onload?.();
      }
    }

    const beginPath = vi.fn();
    const arc = vi.fn();
    const closePath = vi.fn();
    const clip = vi.fn();
    const drawImage = vi.fn();
    const toBlob = vi.fn((callback: (blob: Blob | null) => void) => callback(new Blob(['ok'], { type: 'image/webp' })));
    const context = {
      beginPath,
      arc,
      closePath,
      clip,
      drawImage
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob
    } as any;

    globalThis.Image = MockImage as any;
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'canvas') {
        return canvas;
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement);

    const blob = await actualCropImageToBlob({
      imageSrc: 'data:image/webp;base64,test',
      cropArea: { x: 10, y: 20, width: 100, height: 80 },
      outputWidth: 200,
      outputHeight: 160,
      circular: true,
      mimeType: 'image/webp',
      quality: 0.8
    });
    expect(blob).toBeInstanceOf(Blob);

    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(160);
    expect(beginPath).toHaveBeenCalledTimes(1);
    expect(arc).toHaveBeenCalledWith(100, 80, 80, 0, Math.PI * 2);
    expect(closePath).toHaveBeenCalledTimes(1);
    expect(clip).toHaveBeenCalledTimes(1);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 10, 20, 100, 80, 0, 0, 200, 160);
    expect(toBlob).toHaveBeenCalled();

    createElementSpy.mockRestore();
    globalThis.Image = originalImage;

    const noContextCanvas = {
      getContext: vi.fn(() => null)
    } as any;

    const noContextCreateElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'canvas') {
        return noContextCanvas;
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement);
    globalThis.Image = MockImage as any;

    await expect(actualCropImageToBlob({
      imageSrc: 'data:image/png;base64,test',
      cropArea: { x: 0, y: 0, width: 10, height: 10 },
      outputWidth: 10
    })).rejects.toThrow('当前浏览器不支持图像裁剪');

    noContextCreateElementSpy.mockRestore();
    globalThis.Image = originalImage;
  });
});
