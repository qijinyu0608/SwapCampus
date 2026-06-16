import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishImageManager } from './PublishImageManager';
import { PublishImageManager as PublishImageManagerFromIndex } from './index';

const mocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  dndProps: null as any
}));

vi.mock('@ant-design/icons', () => ({
  PlusOutlined: () => <span>PLUS_ICON</span>
}));

vi.mock('antd', () => ({
  Button: ({ children, icon, onClick, disabled, type }: any) => (
    <button type="button" data-type={type ?? ''} disabled={disabled} onClick={onClick}>
      {icon}
      {children}
    </button>
  ),
  message: {
    success: mocks.success,
    error: mocks.error,
    info: mocks.info
  }
}));

vi.mock('@dnd-kit/core', () => ({
  closestCenter: 'closestCenter',
  DndContext: ({ children, ...props }: any) => {
    mocks.dndProps = props;
    return <div data-testid="dnd-context">{children}</div>;
  },
  DragOverlay: ({ children }: any) => <div data-testid="drag-overlay">{children}</div>,
  KeyboardSensor: function KeyboardSensor() {},
  PointerSensor: function PointerSensor() {},
  useSensor: (_sensor: any, config: any) => ({ config }),
  useSensors: (...sensors: any[]) => sensors
}));

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: (items: any[], from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  },
  rectSortingStrategy: 'rectSortingStrategy',
  SortableContext: ({ children }: any) => <div data-testid="sortable-context">{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: ({ id }: any) => ({
    attributes: { 'data-sortable-id': id },
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false
  })
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => undefined
    }
  }
}));

vi.mock('../image-upload', () => ({
  ImageCropUploadModal: ({ open, title, confirmText, onCancel, onConfirm }: any) => open ? (
    <div>
      <div>{title}</div>
      <button
        type="button"
        onClick={() => onConfirm(new File(['image'], 'cover.png', { type: 'image/png' }), 'blob:cover-preview')}
      >
        {confirmText}
      </button>
      <button type="button" onClick={onCancel}>关闭上传弹窗</button>
    </div>
  ) : null
}));

vi.mock('../layout', () => ({
  SectionHeader: ({ title, aside }: any) => <div><span>{title}</span>{aside}</div>
}));

describe('PublishImageManager', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.dndProps = null;
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn()
    });
  });

  it('re-exports PublishImageManager from the barrel file', () => {
    expect(PublishImageManagerFromIndex).toBe(PublishImageManager);
  });

  it('shows the empty state, opens the upload modal, uploads an image and reports success', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onUpload = vi.fn().mockResolvedValue({
      objectKey: 'cover-1',
      url: 'https://cdn.example.com/cover-1.png',
      width: 1200,
      height: 1200
    });

    render(
      <PublishImageManager
        title="商品图片"
        uploadText="上传图片"
        modalTitle="裁剪图片"
        confirmText="确认上传"
        emptyHint="最多上传 6 张图片"
        items={[]}
        onChange={onChange}
        onUpload={onUpload}
      />
    );

    expect(screen.getByText('商品图片')).toBeInTheDocument();
    expect(screen.getByText('最多上传 6 张图片')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /PLUS_ICON\s+上传图片/ }));
    expect(screen.getByText('裁剪图片')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '确认上传' }));

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith([
        {
          key: 'cover-1',
          url: 'https://cdn.example.com/cover-1.png',
          previewUrl: 'blob:cover-preview',
          width: 1200,
          height: 1200
        }
      ]);
      expect(mocks.success).toHaveBeenCalledWith('图片已上传');
    });
  });

  it('blocks uploads when the maximum image count has already been reached', async () => {
    const user = userEvent.setup();
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const onChange = vi.fn();
    const onUpload = vi.fn().mockResolvedValue({
      objectKey: 'overflow',
      url: 'https://cdn.example.com/overflow.png',
      width: 1200,
      height: 1200
    });
    const { rerender } = render(
      <PublishImageManager
        title="商品图片"
        modalTitle="裁剪图片"
        items={[]}
        maxImages={1}
        onChange={onChange}
        onUpload={onUpload}
      />
    );

    await user.click(screen.getByRole('button', { name: /PLUS_ICON\s+添加图片/ }));

    rerender(
      <PublishImageManager
        title="商品图片"
        modalTitle="裁剪图片"
        items={[
          {
            key: '1',
            url: 'https://cdn.example.com/1.png',
            previewUrl: 'blob:1',
            width: 1200,
            height: 1200
          }
        ]}
        maxImages={1}
        onChange={onChange}
        onUpload={onUpload}
      />
    );

    await user.click(screen.getByRole('button', { name: '保存图片' }));
    expect(onUpload).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith('最多上传 1 张图片');
    expect(revokeSpy).toHaveBeenCalledWith('blob:cover-preview');
    revokeSpy.mockRestore();
  });

  it('renders sortable image tiles, supports edit/remove actions and drag reorder', async () => {
    const user = userEvent.setup();
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const onChange = vi.fn();
    const onUpload = vi.fn();
    const items = [
      {
        key: 'cover',
        url: 'https://cdn.example.com/cover.png',
        previewUrl: 'blob:cover',
        width: 1200,
        height: 1200
      },
      {
        key: 'detail',
        url: 'https://cdn.example.com/detail.png',
        previewUrl: 'https://cdn.example.com/detail.png',
        width: 900,
        height: 900
      }
    ];

    render(
      <PublishImageManager
        title="商品图片"
        modalTitle="裁剪图片"
        items={items}
        onChange={onChange}
        onUpload={onUpload}
      />
    );

    expect(screen.getByLabelText('商品图片排序区')).toBeInTheDocument();
    expect(screen.getByText('封面')).toBeInTheDocument();
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '编辑发布图片 1' }));
    expect(mocks.info).toHaveBeenCalledWith('图片编辑功能暂未开放');

    await user.click(screen.getByRole('button', { name: '删除发布图片 1' }));
    expect(onChange).toHaveBeenCalledWith([
      {
        key: 'detail',
        url: 'https://cdn.example.com/detail.png',
        previewUrl: 'https://cdn.example.com/detail.png',
        width: 900,
        height: 900
      }
    ]);
    expect(revokeSpy).toHaveBeenCalledWith('blob:cover');

    mocks.dndProps.onDragStart({
      active: {
        id: 'cover',
        rect: {
          current: {
            initial: {
              width: 180,
              height: 220
            }
          }
        }
      }
    });
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument();

    mocks.dndProps.onDragEnd({
      active: { id: 'cover' },
      over: { id: 'detail' }
    });
    expect(onChange).toHaveBeenCalledWith([
      {
        key: 'detail',
        url: 'https://cdn.example.com/detail.png',
        previewUrl: 'https://cdn.example.com/detail.png',
        width: 900,
        height: 900
      },
      {
        key: 'cover',
        url: 'https://cdn.example.com/cover.png',
        previewUrl: 'blob:cover',
        width: 1200,
        height: 1200
      }
    ]);

    mocks.dndProps.onDragCancel();

    revokeSpy.mockRestore();
  });
});
