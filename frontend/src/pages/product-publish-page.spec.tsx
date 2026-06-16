import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ProductPublishPage } from './ProductPublishPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  createProductWithImages: vi.fn(),
  fetchProductDetail: vi.fn(),
  params: {} as { id?: string },
  serviceWorkbench: vi.fn(),
  uploadProductImageAsset: vi.fn(),
  fetchPublishingRules: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  updateProductWithImages: vi.fn(),
  antMessageError: vi.fn()
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    Slider: ({ value = 10, onChange }: any) => (
      <input
        aria-label="商品成色"
        type="range"
        min="0"
        max="10"
        step="1"
        value={value}
        onChange={(event) => onChange?.(Number(event.target.value))}
      />
    ),
    message: {
      error: mocks.antMessageError
    }
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useParams: () => mocks.params
  };
});

vi.mock('../services/auth-state', () => ({
  useAuthState: () => ({
    currentUser: { id: 1, displayName: '用户', role: 'USER' }
  })
}));

vi.mock('../services/api', () => ({
  fetchProductDetail: mocks.fetchProductDetail,
  fetchPublishingRules: mocks.fetchPublishingRules,
  getApiErrorMessage: mocks.getApiErrorMessage
}));

vi.mock('../services/product-publish', () => ({
  createProductWithImages: (payload: unknown) => mocks.createProductWithImages(payload),
  updateProductWithImages: (id: number, payload: unknown) => mocks.updateProductWithImages(id, payload),
  uploadProductImageAsset: (file: File) => mocks.uploadProductImageAsset(file)
}));

vi.mock('../services/session', async () => {
  const actual = await vi.importActual<typeof import('../services/session')>('../services/session');
  return {
    ...actual,
    hasTradingAccess: () => true,
    isGuestUser: () => false
  };
});

vi.mock('../components/publish', () => ({
  PublishImageManager: ({ items, onChange }: any) => {
    useEffect(() => {
      if (!items?.length) {
        onChange?.([{ key: 'img-1', url: 'https://img.example.com/1.jpg', previewUrl: 'https://img.example.com/1.jpg' }]);
      }
    }, [items, onChange]);
    return <div>mock-image-manager</div>;
  },
  CampusServicePublishWorkbench: ({ sectionTitle, presetIntent }: any) => {
    mocks.serviceWorkbench({ sectionTitle, presetIntent });
    return <div>{`${sectionTitle}-${presetIntent}`}</div>;
  }
}));

vi.mock('../components/layout', () => ({
  ActionRow: ({ children }: any) => <div>{children}</div>,
  SectionHeader: ({ title }: any) => <div>{title}</div>
}));

vi.mock('../components/feedback', () => ({
  ThinkingOverlay: ({ open }: any) => open ? <div>loading</div> : null
}));

vi.mock('../components/ui', () => ({
  SectionCard: ({ children }: any) => <div>{children}</div>,
  ConfirmActionModal: ({ open, title, description, onConfirm, onCancel, confirmText, cancelText }: any) => open ? (
    <div>
      <h2>{title}</h2>
      {description}
      <button type="button" onClick={onConfirm}>{confirmText}</button>
      <button type="button" onClick={onCancel}>{cancelText}</button>
    </div>
  ) : null
}));

describe('ProductPublishPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.navigate.mockReset();
    mocks.params = {};
    mocks.fetchPublishingRules.mockResolvedValue({ titleRules: [], descriptionRules: [] });
    mocks.fetchProductDetail.mockResolvedValue({
      id: 88,
      title: '二手教材',
      description: '九成新教材',
      price: 52,
      category: '教材资料',
      condition: '9成新',
      images: ['https://img.example.com/existing.jpg']
    });
    mocks.createProductWithImages.mockResolvedValue({
      id: 88,
      title: '高数教材',
      status: 'ON_SALE'
    });
    mocks.updateProductWithImages.mockResolvedValue({
      id: 88,
      title: '二手教材',
      status: 'ON_SALE'
    });
  });

  it('redirects to the product detail page after creating a product', async () => {
    const user = userEvent.setup();

    const { container } = render(
      <MemoryRouter>
        <ProductPublishPage />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('例如：九成计算机网络教材'), '高数教材');
    await user.type(screen.getByPlaceholderText('88'), '88');
    await user.type(screen.getByPlaceholderText('写清使用情况、配件、容量/版本、可交易地点。'), '期末复习用书，少量笔记');

    const form = container.querySelector('form');
    if (!form) {
      throw new Error('publish form not found');
    }
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mocks.createProductWithImages).toHaveBeenCalledWith(expect.objectContaining({
        title: '高数教材',
        price: 88
      }));
      expect(mocks.navigate).toHaveBeenCalledWith('/products/88', { replace: true });
    });
  });

  it('requires explicit confirmation before publishing suspicious prices', async () => {
    const user = userEvent.setup();
    mocks.createProductWithImages
      .mockRejectedValueOnce({
        response: {
          data: {
            code: 'PRICE_CONFIRMATION_REQUIRED',
            review: {
              provider: 'deepseek',
              model: 'deepseek-v4-flash',
              status: 'enabled',
              decision: 'APPROVED',
              shouldBlock: false,
              selectedCategory: '教材资料',
              reason: '商品信息基本完整',
              issues: [],
              priceReview: {
                verdict: 'HIGH',
                confidence: 'HIGH',
                reason: '同类教材通常不会接近这个价位',
                suggestedPriceMin: 20,
                suggestedPriceMax: 80,
                requiresConfirmation: true
              }
            }
          }
        }
      })
      .mockResolvedValueOnce({
        id: 99,
        title: '高数教材',
        status: 'ON_SALE'
      });

    const { container } = render(
      <MemoryRouter>
        <ProductPublishPage />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('例如：九成计算机网络教材'), '高数教材');
    await user.type(screen.getByPlaceholderText('88'), '399');
    await user.type(screen.getByPlaceholderText('写清使用情况、配件、容量/版本、可交易地点。'), '期末复习用书，少量笔记');

    const form = container.querySelector('form');
    if (!form) {
      throw new Error('publish form not found');
    }
    fireEvent.submit(form);

    expect(await screen.findByRole('heading', { name: '价格可能不太合理' })).toBeInTheDocument();
    expect(screen.getByText(/当前价格：¥399/)).toBeInTheDocument();
    expect(mocks.createProductWithImages).toHaveBeenCalledTimes(1);
    expect(mocks.createProductWithImages).toHaveBeenNthCalledWith(1, expect.objectContaining({
      price: 399
    }));

    await user.click(screen.getByRole('button', { name: '继续发布' }));

    await waitFor(() => {
      expect(mocks.createProductWithImages).toHaveBeenCalledTimes(2);
      expect(mocks.createProductWithImages).toHaveBeenNthCalledWith(2, expect.objectContaining({
        price: 399,
        confirmPriceReview: true
      }));
      expect(mocks.navigate).toHaveBeenCalledWith('/products/99', { replace: true });
    });
  });

  it('switches to service publish mode and renders the campus service workbench', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ProductPublishPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('tab', { name: '我要接单挣钱' }));
    expect(await screen.findByText('发布可预约服务-OFFER')).toBeInTheDocument();
    expect(mocks.serviceWorkbench).toHaveBeenCalledWith({
      sectionTitle: '发布可预约服务',
      presetIntent: 'OFFER'
    });
  });

  it('loads product edit mode and saves with the update API', async () => {
    const user = userEvent.setup();
    mocks.params = { id: '88' };

    render(
      <MemoryRouter>
        <ProductPublishPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchProductDetail).toHaveBeenCalledWith(88);
    });

    await user.clear(screen.getByPlaceholderText('例如：九成计算机网络教材'));
    await user.type(screen.getByPlaceholderText('例如：九成计算机网络教材'), '更新后的教材');
    await user.clear(screen.getByPlaceholderText('88'));
    await user.type(screen.getByPlaceholderText('88'), '66');
    await user.clear(screen.getByPlaceholderText('写清使用情况、配件、容量/版本、可交易地点。'));
    await user.type(screen.getByPlaceholderText('写清使用情况、配件、容量/版本、可交易地点。'), '更新后的描述');

    const form = document.querySelector('form');
    if (!form) {
      throw new Error('publish form not found');
    }
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mocks.updateProductWithImages).toHaveBeenCalledWith(88, expect.objectContaining({
        title: '更新后的教材',
        price: 66
      }));
      expect(mocks.navigate).toHaveBeenCalledWith('/products/88', { replace: true });
    });
  });
});
