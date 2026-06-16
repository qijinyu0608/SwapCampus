import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStateProvider, useAuthState } from './auth-state';

const mocks = vi.hoisted(() => ({
  fetchCurrentSession: vi.fn(),
  clearCurrentUserStorage: vi.fn(),
  getCurrentUser: vi.fn(),
  saveCurrentUser: vi.fn(),
  subscribeSessionChange: vi.fn()
}));

vi.mock('./api', () => ({
  fetchCurrentSession: mocks.fetchCurrentSession
}));

vi.mock('./session', () => ({
  clearCurrentUserStorage: mocks.clearCurrentUserStorage,
  getCurrentUser: mocks.getCurrentUser,
  saveCurrentUser: mocks.saveCurrentUser,
  subscribeSessionChange: mocks.subscribeSessionChange
}));

function Consumer() {
  const { currentUser, hydrated, setCurrentUser, refreshCurrentUser, clearCurrentUser } = useAuthState();

  return (
    <div>
      <span data-testid="user">{currentUser?.displayName ?? 'none'}</span>
      <span data-testid="hydrated">{hydrated ? 'yes' : 'no'}</span>
      <button type="button" onClick={() => setCurrentUser({
        id: 2,
        displayName: '手动用户',
        email: 'manual@example.com',
        role: 'USER'
      } as any)}
      >
        set-user
      </button>
      <button type="button" onClick={() => setCurrentUser(null)}>
        clear-via-set
      </button>
      <button type="button" onClick={() => void refreshCurrentUser()}>
        refresh
      </button>
      <button type="button" onClick={() => clearCurrentUser()}>
        clear-direct
      </button>
    </div>
  );
}

describe('auth-state provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockReturnValue(null);
    mocks.subscribeSessionChange.mockImplementation((listener: () => void) => {
      (mocks.subscribeSessionChange as any).listener = listener;
      return () => undefined;
      });
  });

  afterEach(() => {
    cleanup();
  });

  it('hydrates current user successfully and responds to session updates', async () => {
    mocks.fetchCurrentSession.mockResolvedValue({
      user: { id: 1, displayName: '初始用户', email: 'init@example.com', role: 'USER' }
    });

    render(
      <AuthStateProvider>
        <Consumer />
      </AuthStateProvider>
    );

    expect(screen.getByTestId('hydrated').textContent).toBe('no');
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('初始用户');
      expect(screen.getByTestId('hydrated').textContent).toBe('yes');
    });
    expect(mocks.saveCurrentUser).toHaveBeenCalledWith({
      id: 1,
      displayName: '初始用户',
      email: 'init@example.com',
      role: 'USER'
    });

    mocks.getCurrentUser.mockReturnValue({
      id: 3,
      displayName: '外部变化',
      email: 'external@example.com',
      role: 'USER'
    });
    act(() => {
      (mocks.subscribeSessionChange as any).listener();
    });
    expect(screen.getByTestId('user').textContent).toBe('外部变化');
  });

  it('handles manual set, refresh success/failure, and clear', async () => {
    mocks.fetchCurrentSession
      .mockResolvedValueOnce({
        user: { id: 1, displayName: '初始用户', email: 'init@example.com', role: 'USER' }
      })
      .mockResolvedValueOnce({
        user: { id: 4, displayName: '刷新用户', email: 'refresh@example.com', role: 'USER' }
      })
      .mockRejectedValueOnce(new Error('expired'));

    render(
      <AuthStateProvider>
        <Consumer />
      </AuthStateProvider>
    );

    await screen.findByText('初始用户');

    await act(async () => {
      screen.getByRole('button', { name: 'set-user' }).click();
    });
    expect(mocks.saveCurrentUser).toHaveBeenCalledWith({
      id: 2,
      displayName: '手动用户',
      email: 'manual@example.com',
      role: 'USER'
    });
    expect(screen.getByTestId('user').textContent).toBe('手动用户');

    await act(async () => {
      screen.getByRole('button', { name: 'refresh' }).click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('刷新用户');
    });

    await act(async () => {
      screen.getByRole('button', { name: 'refresh' }).click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('none');
    });
    expect(mocks.clearCurrentUserStorage).toHaveBeenCalled();

    await act(async () => {
      screen.getByRole('button', { name: 'clear-direct' }).click();
      screen.getByRole('button', { name: 'clear-via-set' }).click();
    });
    expect(mocks.clearCurrentUserStorage).toHaveBeenCalled();
  });
});
