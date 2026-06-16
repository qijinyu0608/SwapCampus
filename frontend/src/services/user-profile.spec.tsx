import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchUserProfile: vi.fn(),
  fetchUserTrustSummary: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback)
}));

vi.mock('./api', () => ({
  fetchUserProfile: mocks.fetchUserProfile,
  fetchUserTrustSummary: mocks.fetchUserTrustSummary,
  getApiErrorMessage: mocks.getApiErrorMessage
}));

import { buildCurrentUserProfileBundle, useCurrentUserProfileBundle } from './user-profile';

function Consumer({ user }: { user?: any }) {
  const bundle = useCurrentUserProfileBundle(user);

  return (
    <div>
      <span data-testid="loading">{bundle.loading ? 'yes' : 'no'}</span>
      <span data-testid="error">{bundle.errorMessage || 'none'}</span>
      <span data-testid="credit">{String(bundle.creditScore)}</span>
      <span data-testid="name">{bundle.presentation.displayName}</span>
    </div>
  );
}

describe('user-profile bundle helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('builds bundle from trust summary, profile and current user priority', () => {
    const bundle = buildCurrentUserProfileBundle({
      currentUser: { id: 1, displayName: '当前用户', creditScore: 60, role: 'USER' } as any,
      profile: { id: 1, displayName: '资料用户', creditScore: 70 } as any,
      trustSummary: { id: 1, displayName: '信誉用户', creditScore: 88 } as any
    });

    expect(bundle.creditScore).toBe(88);
    expect(bundle.presentation.displayName).toBe('信誉用户');
  });

  it('skips loading when current user is absent', () => {
    render(<Consumer />);

    expect(screen.getByTestId('loading').textContent).toBe('no');
    expect(screen.getByTestId('error').textContent).toBe('none');
    expect(mocks.fetchUserProfile).not.toHaveBeenCalled();
    expect(mocks.fetchUserTrustSummary).not.toHaveBeenCalled();
  });

  it('loads profile bundle successfully', async () => {
    mocks.fetchUserProfile.mockResolvedValue({
      id: 8,
      displayName: '资料用户',
      creditScore: 66
    });
    mocks.fetchUserTrustSummary.mockResolvedValue({
      id: 8,
      displayName: '信誉用户',
      creditScore: 90
    });

    render(<Consumer user={{ id: 8, displayName: '当前用户', creditScore: 55, role: 'USER' }} />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('no');
      expect(screen.getByTestId('credit').textContent).toBe('90');
      expect(screen.getByTestId('name').textContent).toBe('信誉用户');
      expect(screen.getByTestId('error').textContent).toBe('none');
    });
  });

  it('handles bundle loading failure', async () => {
    mocks.fetchUserProfile.mockRejectedValue(new Error('failed'));
    mocks.fetchUserTrustSummary.mockRejectedValue(new Error('failed'));

    render(<Consumer user={{ id: 8, displayName: '当前用户', creditScore: 55, role: 'USER' }} />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('no');
      expect(screen.getByTestId('error').textContent).toBe('个人资料加载失败');
      expect(screen.getByTestId('name').textContent).toBe('当前用户');
    });
  });
});
