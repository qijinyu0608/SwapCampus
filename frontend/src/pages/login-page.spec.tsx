import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  locationState: null as { mode?: string; from?: string } | null,
  setCurrentUser: vi.fn(),
  messageInfo: vi.fn(),
  messageSuccess: vi.fn(),
  loginUser: vi.fn(),
  registerUserMultipart: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback)
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      info: mocks.messageInfo,
      success: mocks.messageSuccess
    }
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ state: mocks.locationState })
  };
});

vi.mock('../services/auth-state', () => ({
  useAuthState: () => ({
    setCurrentUser: mocks.setCurrentUser
  })
}));

vi.mock('../services/api', () => ({
  loginUser: (payload: unknown) => mocks.loginUser(payload),
  registerUserMultipart: (payload: unknown) => mocks.registerUserMultipart(payload),
  getApiErrorMessage: (error: unknown, fallback: string) => mocks.getApiErrorMessage(error, fallback)
}));

vi.mock('../components/image-upload', () => ({
  ImageCropUploadModal: ({ open, title, onConfirm, onCancel }: any) => (
    open ? (
      <div>
        <span>{title}</span>
        <button
          type="button"
          onClick={() => onConfirm(new File(['mock'], `${title}.png`, { type: 'image/png' }), `blob:${title}`)}
        >
          确认{title}
        </button>
        <button type="button" onClick={onCancel}>关闭{title}</button>
      </div>
    ) : null
  )
}));

vi.mock('../components/user/UserAvatar', () => ({
  UserAvatar: ({ src, fallbackLabel }: any) => <span>{src || fallbackLabel || 'avatar'}</span>
}));

if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    cleanup();
    mocks.navigate.mockReset();
    mocks.setCurrentUser.mockReset();
    mocks.messageInfo.mockReset();
    mocks.messageSuccess.mockReset();
    mocks.loginUser.mockReset();
    mocks.registerUserMultipart.mockReset();
    mocks.getApiErrorMessage.mockImplementation((_error, fallback) => fallback);
    mocks.locationState = null;
    vi.useRealTimers();
  });

  it('redirects admins to the admin page after login', async () => {
    mocks.loginUser.mockResolvedValue({
      message: '登录成功',
      user: { id: 1, displayName: '管理员', role: 'ADMIN' }
    });

    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('学号或邮箱'), 'admin');
    await user.type(screen.getByPlaceholderText('请输入密码'), 'password');

    const form = container.querySelector('form');
    if (!form) {
      throw new Error('login form not found');
    }
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mocks.loginUser).toHaveBeenCalledWith({ account: 'admin', password: 'password' });
      expect(mocks.setCurrentUser).toHaveBeenCalledWith({ id: 1, displayName: '管理员', role: 'ADMIN' });
      expect(mocks.navigate).toHaveBeenCalledWith('/admin');
    });
  });

  it('supports the register flow with avatar and student card uploads', async () => {
    mocks.locationState = { mode: 'register', from: '/credit-center' };
    mocks.registerUserMultipart.mockResolvedValue({
      message: '注册成功',
      user: { id: 10, displayName: '注册用户', role: 'USER' }
    });

    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: '上传自定义头像' }));
    await user.click(screen.getByRole('button', { name: '确认上传头像' }));

    await user.click(screen.getByRole('button', { name: /上传学生证\/学生卡照片/ }));
    await user.click(screen.getByRole('button', { name: '确认上传学生证/学生卡照片' }));

    const [emailInput, studentIdInput] = screen.getAllByPlaceholderText('例如：202600001');
    await user.type(screen.getByPlaceholderText('请输入用户名，可重复'), '注册用户');
    await user.type(emailInput, '202600001');
    await user.type(screen.getByPlaceholderText('请输入 6 位验证码'), '654321');
    await user.type(studentIdInput, '202600001');

    const graduationYearInput = container.querySelector('input[placeholder="例如：2028"]');
    if (!graduationYearInput) {
      throw new Error('graduation year input not found');
    }
    await user.type(graduationYearInput, '2028');

    await user.type(screen.getByPlaceholderText('请设置登录密码'), 'password123');
    await user.type(screen.getByPlaceholderText('请再次输入密码'), 'password123');

    const form = container.querySelector('form');
    if (!form) {
      throw new Error('register form not found');
    }
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mocks.registerUserMultipart).toHaveBeenCalledTimes(1);
      expect(mocks.setCurrentUser).toHaveBeenCalledWith({ id: 10, displayName: '注册用户', role: 'USER' });
      expect(mocks.navigate).toHaveBeenCalledWith('/credit-center');
    });

    const submitted = mocks.registerUserMultipart.mock.calls[0]?.[0] as FormData;
    expect(submitted).toBeInstanceOf(FormData);
    expect(submitted.get('studentId')).toBe('202600001');
    expect(submitted.get('displayName')).toBe('注册用户');
    expect(submitted.get('email')).toBe('202600001@bjfu.edu.cn');
    expect(submitted.get('verificationCode')).toBe('654321');
    expect(submitted.get('graduationYear')).toBe('2028');
    expect(submitted.get('password')).toBe('password123');
    expect(submitted.get('avatar')).toBeInstanceOf(File);
    expect(submitted.get('studentCard')).toBeInstanceOf(File);
    expect(mocks.messageSuccess).toHaveBeenCalledWith('头像已准备好，注册后会自动上传');
    expect(mocks.messageSuccess).toHaveBeenCalledWith('证件照片已准备好');
  });

  it('shows email validation feedback and sends a verification code', async () => {
    mocks.locationState = { mode: 'register' };
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.click(screen.getAllByRole('button', { name: '发送验证码' })[0]);
    expect(await screen.findByText('请先填写学校邮箱')).toBeInTheDocument();

    const [emailInput] = screen.getAllByPlaceholderText('例如：202600001');
    await user.type(emailInput, '202600001');
    await user.click(screen.getAllByRole('button', { name: '发送验证码' })[0]);

    await waitFor(() => {
      expect(mocks.messageInfo).toHaveBeenCalledWith('验证码已发送');
    });
  });
});
