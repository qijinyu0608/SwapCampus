import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { SearchPage } from './SearchPage';

const navigate = vi.fn();
const setCurrentUser = vi.fn();
const mocks = vi.hoisted(() => ({
  loginUserMock: vi.fn(async () => ({
    message: '登录成功',
    user: { id: 9, displayName: '登录用户', role: 'USER' }
  })),
  registerUserMultipartMock: vi.fn(async () => ({
    message: '注册成功',
    user: { id: 10, displayName: '注册用户', role: 'USER' }
  })),
  fetchProductsMock: vi.fn(async () => ({
    items: [
      {
        id: 2,
        title: '蓝牙耳机',
        description: '九成新',
        price: 99,
        category: '数码电子',
        condition: '九成新',
        tags: ['耳机', '蓝牙'],
        status: 'ON_SALE',
        sellerName: '卖家A',
        sellerCreditScore: 88
      },
      {
        id: 3,
        title: '高数教材',
        description: '正版',
        price: 20,
        category: '教材资料',
        condition: '八成新',
        tags: ['教材'],
        status: 'ON_SALE',
        sellerName: '卖家B',
        sellerCreditScore: 75
      }
    ],
    pagination: { page: 1, pageSize: 60, total: 2, totalPages: 1 }
  }))
}));
const useSearchParamsState = new URLSearchParams();
const setSearchParams = vi.fn((next: Record<string, string>) => {
  useSearchParamsState.forEach((_value, key) => useSearchParamsState.delete(key));
  Object.entries(next).forEach(([key, value]) => useSearchParamsState.set(key, value));
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
    useLocation: () => ({ state: null }),
    useSearchParams: () => [useSearchParamsState, setSearchParams]
  };
});

vi.mock('../services/auth-state', () => ({
  useAuthState: () => ({
    currentUser: { id: 1, displayName: '用户', role: 'USER' },
    setCurrentUser
  })
}));

vi.mock('../components/image-upload', () => ({
  ImageCropUploadModal: ({ open }: { open: boolean }) => open ? <div>mock-upload-modal</div> : null
}));

vi.mock('../services/api', () => ({
  fetchPublishingRules: vi.fn(async () => ({ titleRules: [], descriptionRules: [] })),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  loginUser: mocks.loginUserMock,
  registerUserMultipart: mocks.registerUserMultipartMock,
  fetchProducts: mocks.fetchProductsMock,
  ProductSummary: {}
}));

vi.mock('../services/favorites', () => ({
  subscribeFavorites: vi.fn(() => () => undefined)
}));

describe('page-level behaviors', () => {
  beforeEach(() => {
    navigate.mockReset();
    setCurrentUser.mockReset();
    setSearchParams.mockClear();
    mocks.loginUserMock.mockClear();
    mocks.registerUserMultipartMock.mockClear();
    mocks.fetchProductsMock.mockClear();
    useSearchParamsState.forEach((_value, key) => useSearchParamsState.delete(key));
  });

  it('logs in from the login page', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('学号或邮箱'), '202600001');
    await user.type(screen.getByPlaceholderText('请输入密码'), 'password');
    const form = container.querySelector('form');
    if (!form) {
      throw new Error('login form not found');
    }
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mocks.loginUserMock).toHaveBeenCalledWith({ account: '202600001', password: 'password' });
      expect(setCurrentUser).toHaveBeenCalledWith({ id: 9, displayName: '登录用户', role: 'USER' });
      expect(navigate).toHaveBeenCalledWith('/');
    });
  });

  it('searches products and applies filters', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('蓝牙耳机')).toBeInTheDocument();
    expect(screen.getByText('高数教材')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('搜索手机、电脑、教材、卡券'), '耳机');
    await user.keyboard('{Enter}');
    expect(setSearchParams).toHaveBeenCalledWith({ q: '耳机' });
  });
});
