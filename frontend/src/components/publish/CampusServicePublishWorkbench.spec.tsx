import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CampusServicePublishWorkbench } from './CampusServicePublishWorkbench';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  createCampusServiceListing: vi.fn(),
  fetchCampusServiceDetail: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  updateCampusServiceListing: vi.fn(),
  useAuthState: vi.fn(),
  hasTradingAccess: vi.fn(),
  isGuestUser: vi.fn()
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate
  };
});

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');

  const Select = ({ options = [], value, onChange, id }: any) => (
    <select
      id={id}
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value)}
    >
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  const InputNumber = ({ value, onChange, id, placeholder, disabled, min, max }: any) => (
    <input
      id={id}
      type="number"
      value={value ?? ''}
      min={min}
      max={max}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => {
        const next = event.target.value;
        onChange?.(next === '' ? undefined : Number(next));
      }}
    />
  );

  const DatePicker = ({ value, onChange, id, placeholder }: any) => (
    <input
      id={id}
      value={typeof value === 'string' ? value : value ?? ''}
      placeholder={placeholder}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );

  return {
    ...actual,
    Select,
    InputNumber,
    DatePicker
  };
});

vi.mock('../../services/auth-state', () => ({
  useAuthState: () => mocks.useAuthState()
}));

vi.mock('../../services/api', () => ({
  createCampusServiceListing: (payload: unknown) => mocks.createCampusServiceListing(payload),
  fetchCampusServiceDetail: (listingId: number) => mocks.fetchCampusServiceDetail(listingId),
  getApiErrorMessage: (error: unknown, fallback: string) => mocks.getApiErrorMessage(error, fallback),
  updateCampusServiceListing: (listingId: number, payload: unknown) => mocks.updateCampusServiceListing(listingId, payload),
  uploadImageAsset: vi.fn()
}));

vi.mock('../../services/session', async () => {
  const actual = await vi.importActual<typeof import('../../services/session')>('../../services/session');
  return {
    ...actual,
    hasTradingAccess: (user: unknown) => mocks.hasTradingAccess(user),
    isGuestUser: (user: unknown) => mocks.isGuestUser(user)
  };
});

vi.mock('../layout', () => ({
  ActionRow: ({ children }: any) => <div>{children}</div>,
  PageCard: ({ children }: any) => <div>{children}</div>,
  SectionHeader: ({ title }: any) => <div>{title}</div>
}));

vi.mock('../feedback', () => ({
  ThinkingOverlay: ({ open }: { open: boolean }) => open ? <div>submitting</div> : null
}));

vi.mock('./PublishImageManager', () => ({
  PublishImageManager: ({ onChange }: any) => {
    return (
      <button
        type="button"
        onClick={() => onChange([
          {
            key: 'img-1',
            url: 'https://cdn.example.com/service-cover.jpg',
            previewUrl: 'https://cdn.example.com/service-cover.jpg',
            width: 1200,
            height: 900
          }
        ])}
      >
        mock-publish-image-manager
      </button>
    );
  }
}));

describe('CampusServicePublishWorkbench', () => {
  function buildFutureDateTimeLabel(minutesFromNow: number) {
    const date = new Date(Date.now() + minutesFromNow * 60 * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }

  function buildFutureIso(minutesFromNow: number) {
    return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
  }

  function createCampusServiceDetail(overrides: Record<string, unknown> = {}) {
    return {
      id: 301,
      title: '原始服务标题',
      description: '原始服务描述',
      intent: 'OFFER',
      pattern: 'REUSABLE',
      priceMode: 'FIXED',
      reward: 18,
      locationMode: 'ON_SITE',
      locationNote: '南门集合',
      estimatedMinutes: 45,
      urgency: 'TODAY',
      itemCount: 2,
      trustNote: '提前联系',
      images: ['https://cdn.example.com/original-cover.jpg'],
      fulfillment: {
        validUntilAt: buildFutureIso(180),
        mode: 'DROP_OFF',
        maxTotalOrders: 3,
        maxConcurrentOrders: 2
      },
      detailBase: {
        title: '原始服务标题',
        description: '原始服务描述',
        images: ['https://cdn.example.com/original-cover.jpg']
      },
      ...overrides
    } as any;
  }

  async function uploadMockImage(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'mock-publish-image-manager' }));
  }

  function fillRequiredFields(overrides: {
    title?: string;
    reward?: string;
    description?: string;
    validUntilAt?: string;
  } = {}) {
    fireEvent.change(screen.getByLabelText('求助标题'), {
      target: { value: overrides.title ?? '代取快递到 13 号公寓' }
    });
    fireEvent.change(screen.getByLabelText('预算 / 报价'), {
      target: { value: overrides.reward ?? '8' }
    });
    fireEvent.change(screen.getByLabelText('补充说明'), {
      target: { value: overrides.description ?? '今晚 8 点前帮忙带到宿舍楼下' }
    });
    fireEvent.change(screen.getByLabelText('有效截止时间'), {
      target: { value: overrides.validUntilAt ?? buildFutureDateTimeLabel(120) }
    });
  }

  function submitForm() {
    const form = document.querySelector('form');
    if (!form) {
      throw new Error('publish form not found');
    }
    fireEvent.submit(form);
  }

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.navigate.mockReset();
    mocks.createCampusServiceListing.mockResolvedValue({ id: 801 });
    mocks.fetchCampusServiceDetail.mockResolvedValue(createCampusServiceDetail());
    mocks.getApiErrorMessage.mockImplementation((_error, fallback) => fallback);
    mocks.updateCampusServiceListing.mockResolvedValue(createCampusServiceDetail());
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 11, displayName: '发布者', email: 'publisher@example.com', role: 'USER' }
    });
    mocks.hasTradingAccess.mockReturnValue(true);
    mocks.isGuestUser.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
  });

  it('submits a campus service payload and redirects to the published listing', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CampusServicePublishWorkbench />
      </MemoryRouter>
    );

    await uploadMockImage(user);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('地点补充 / 路线说明'), {
      target: { value: '东门快递柜' }
    });
    fireEvent.change(screen.getByLabelText('交接备注'), {
      target: { value: '到楼下后发消息' }
    });
    submitForm();

    await waitFor(() => {
      expect(mocks.createCampusServiceListing).toHaveBeenCalledTimes(1);
    });

    const payload = mocks.createCampusServiceListing.mock.calls[0][0];
    expect(payload).toMatchObject({
      intent: 'REQUEST',
      pattern: 'ONE_TIME',
      title: '代取快递到 13 号公寓',
      description: '今晚 8 点前帮忙带到宿舍楼下',
      priceMode: 'FIXED',
      amount: 8,
      reward: 8,
      locationMode: 'FLEXIBLE',
      locationNote: '东门快递柜',
      estimatedMinutes: 30,
      urgency: 'NORMAL',
      maxTotalOrders: 1,
      maxConcurrentOrders: 1,
      imageUrls: ['https://cdn.example.com/service-cover.jpg']
    });
    expect(String(payload.validFromAt)).toContain('T');
    expect(String(payload.validUntilAt)).toContain('T');
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/801', { replace: true });
  });

  it('blocks submit when current user cannot publish campus services', async () => {
    const user = userEvent.setup();

    mocks.hasTradingAccess.mockReturnValue(false);
    mocks.isGuestUser.mockReturnValue(true);

    render(
      <MemoryRouter>
        <CampusServicePublishWorkbench />
      </MemoryRouter>
    );

    await uploadMockImage(user);
    fillRequiredFields();
    submitForm();

    await waitFor(() => {
      expect(screen.getByText('浏览账号不能发布校园服务任务。')).toBeInTheDocument();
    });
    expect(mocks.createCampusServiceListing).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('requires at least one uploaded image before publishing', async () => {
    render(
      <MemoryRouter>
        <CampusServicePublishWorkbench />
      </MemoryRouter>
    );

    fillRequiredFields();
    submitForm();

    await waitFor(() => {
      expect(screen.getByText('请至少上传 1 张服务图片。')).toBeInTheDocument();
    });
    expect(mocks.createCampusServiceListing).not.toHaveBeenCalled();
  });

  it('validates invalid and out-of-range expiration times before calling create', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CampusServicePublishWorkbench />
      </MemoryRouter>
    );

    await uploadMockImage(user);

    fillRequiredFields({ validUntilAt: 'not-a-date' });
    submitForm();
    await waitFor(() => {
      expect(screen.getByText('有效截止时间格式无效，请重新选择。')).toBeInTheDocument();
    });

    fillRequiredFields({ validUntilAt: buildFutureDateTimeLabel(10) });
    submitForm();
    await waitFor(() => {
      expect(screen.getByText('有效期不能短于 30 分钟。')).toBeInTheDocument();
    });

    fillRequiredFields({ validUntilAt: buildFutureDateTimeLabel(31 * 24 * 60) });
    submitForm();
    await waitFor(() => {
      expect(screen.getByText('有效期不能超过 30 天。')).toBeInTheDocument();
    });

    expect(mocks.createCampusServiceListing).not.toHaveBeenCalled();
  });

  it('validates concurrent order limit against total limit', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CampusServicePublishWorkbench />
      </MemoryRouter>
    );

    await uploadMockImage(user);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('招募人数上限'), {
      target: { value: '1' }
    });
    fireEvent.change(screen.getByLabelText('同时接单上限'), {
      target: { value: '2' }
    });
    submitForm();

    await waitFor(() => {
      expect(screen.getByText('同时进行中上限不能高于总名额上限。')).toBeInTheDocument();
    });
    expect(mocks.createCampusServiceListing).not.toHaveBeenCalled();
  });

  it('drops reward from the payload when the price mode is free', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CampusServicePublishWorkbench />
      </MemoryRouter>
    );

    await uploadMockImage(user);
    fireEvent.change(screen.getByLabelText('报价方式'), {
      target: { value: 'FREE' }
    });
    fireEvent.change(screen.getByLabelText('求助标题'), {
      target: { value: '免费代取资料' }
    });
    fireEvent.change(screen.getByLabelText('补充说明'), {
      target: { value: '资料在教学楼门卫处领取' }
    });
    fireEvent.change(screen.getByLabelText('有效截止时间'), {
      target: { value: buildFutureDateTimeLabel(120) }
    });
    submitForm();

    await waitFor(() => {
      expect(mocks.createCampusServiceListing).toHaveBeenCalledTimes(1);
    });

    const payload = mocks.createCampusServiceListing.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: '免费代取资料',
      description: '资料在教学楼门卫处领取',
      priceMode: 'FREE',
      amount: 0
    });
    expect(payload).not.toHaveProperty('reward');
  });

  it('loads an existing listing in edit mode and saves updates back to the detail page', async () => {
    render(
      <MemoryRouter>
        <CampusServicePublishWorkbench listingId={301} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchCampusServiceDetail).toHaveBeenCalledWith(301);
    });
    expect(await screen.findByDisplayValue('原始服务标题')).toBeInTheDocument();
    expect(screen.getByDisplayValue('原始服务描述')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('服务标题'), {
      target: { value: '更新后的服务标题' }
    });
    fireEvent.change(screen.getByLabelText('收费 / 报价'), {
      target: { value: '28' }
    });
    fireEvent.change(screen.getByLabelText('补充说明'), {
      target: { value: '更新后的服务描述' }
    });
    fireEvent.change(screen.getByLabelText('有效截止时间'), {
      target: { value: buildFutureDateTimeLabel(180) }
    });
    submitForm();

    await waitFor(() => {
      expect(mocks.updateCampusServiceListing).toHaveBeenCalledTimes(1);
    });

    const [listingId, payload] = mocks.updateCampusServiceListing.mock.calls[0];
    expect(listingId).toBe(301);
    expect(payload).toMatchObject({
      pattern: 'REUSABLE',
      title: '更新后的服务标题',
      description: '更新后的服务描述',
      priceMode: 'FIXED',
      amount: 28,
      reward: 28,
      locationMode: 'ON_SITE',
      locationNote: '南门集合',
      estimatedMinutes: 30,
      urgency: 'NORMAL',
      fulfillmentMode: 'DROP_OFF',
      itemCount: 2,
      maxTotalOrders: undefined,
      maxConcurrentOrders: 1,
      trustNote: '提前联系',
      imageUrls: ['https://cdn.example.com/original-cover.jpg']
    });
    expect(payload).not.toHaveProperty('intent');
    expect(payload).not.toHaveProperty('validFromAt');
    expect(String(payload.validUntilAt)).toContain('T');
    expect(mocks.createCampusServiceListing).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/301', { replace: true });
  });

  it('shows an error when edit mode cannot load the existing listing', async () => {
    mocks.fetchCampusServiceDetail.mockRejectedValueOnce(new Error('load failed'));

    render(
      <MemoryRouter>
        <CampusServicePublishWorkbench listingId={301} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('服务详情加载失败，请稍后重试。')).toBeInTheDocument();
    });
    expect(mocks.updateCampusServiceListing).not.toHaveBeenCalled();
  });
});
