import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CampusServicePublishWorkbench } from './CampusServicePublishWorkbench';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  createCampusServiceListing: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
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
  getApiErrorMessage: (error: unknown, fallback: string) => mocks.getApiErrorMessage(error, fallback),
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

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.navigate.mockReset();
    mocks.createCampusServiceListing.mockResolvedValue({ id: 801 });
    mocks.getApiErrorMessage.mockImplementation((_error, fallback) => fallback);
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

    await user.click(screen.getByRole('button', { name: 'mock-publish-image-manager' }));
    fireEvent.change(screen.getByLabelText('求助标题'), {
      target: { value: '代取快递到 13 号公寓' }
    });
    fireEvent.change(screen.getByLabelText('预算 / 报价'), {
      target: { value: '8' }
    });
    fireEvent.change(screen.getByLabelText('地点补充 / 路线说明'), {
      target: { value: '东门快递柜' }
    });
    fireEvent.change(screen.getByLabelText('补充说明'), {
      target: { value: '今晚 8 点前帮忙带到宿舍楼下' }
    });
    fireEvent.change(screen.getByLabelText('交接备注'), {
      target: { value: '到楼下后发消息' }
    });
    fireEvent.change(screen.getByLabelText('有效截止时间'), {
      target: { value: buildFutureDateTimeLabel(120) }
    });

    const form = document.querySelector('form');
    if (!form) {
      throw new Error('publish form not found');
    }
    fireEvent.submit(form);

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
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services', {
      state: { selectedListingId: 801 }
    });
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

    await user.click(screen.getByRole('button', { name: 'mock-publish-image-manager' }));
    fireEvent.change(screen.getByLabelText('求助标题'), {
      target: { value: '代取快递到 13 号公寓' }
    });
    fireEvent.change(screen.getByLabelText('预算 / 报价'), {
      target: { value: '8' }
    });
    fireEvent.change(screen.getByLabelText('补充说明'), {
      target: { value: '今晚 8 点前帮忙带到宿舍楼下' }
    });
    fireEvent.change(screen.getByLabelText('有效截止时间'), {
      target: { value: buildFutureDateTimeLabel(120) }
    });

    const form = document.querySelector('form');
    if (!form) {
      throw new Error('publish form not found');
    }
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('浏览账号不能发布校园服务任务。')).toBeInTheDocument();
    });
    expect(mocks.createCampusServiceListing).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
