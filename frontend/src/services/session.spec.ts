import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners = new Set<() => void>();

vi.stubGlobal('window', {
  addEventListener: vi.fn((_event: string, listener: () => void) => {
    listeners.add(listener);
  }),
  removeEventListener: vi.fn((_event: string, listener: () => void) => {
    listeners.delete(listener);
  }),
  dispatchEvent: vi.fn(() => true)
});

const storage = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    storage.delete(key);
  }),
  clear: vi.fn(() => storage.clear()),
  key: vi.fn(),
  length: 0
});

import {
  clearCurrentUserStorage,
  getCurrentUser,
  getDevAuthToken,
  getRoleLabel,
  getSession,
  hasAdminAccess,
  hasTradingAccess,
  isGuestUser,
  saveCurrentUser,
  saveDevAuthToken,
  saveSession,
  subscribeSessionChange,
  type SessionUser
} from './session';

describe('session storage helpers', () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  const user: SessionUser = {
    id: 1,
    studentId: '202600001',
    displayName: '小明',
    email: 'xm@example.com',
    avatarUrl: null,
    avatarFrame: null,
    avatarFrameUnlocked: false,
    trustedBadgeUnlocked: false,
    role: 'USER',
    creditScore: 88,
    verificationStatus: 'APPROVED',
    accountStatus: 'ACTIVE'
  };

  it('persists and reads session data', () => {
    saveSession({ user });
    expect(getSession()).toEqual({ user });
    expect(getCurrentUser()).toEqual(user);
  });

  it('rejects invalid session payloads and clears auth data', () => {
    storage.set('swapcampus-session', JSON.stringify({ user: { displayName: 'bad' } }));
    expect(getSession()).toBeNull();
    clearCurrentUserStorage();
    expect(storage.size).toBe(0);
  });

  it('manages dev auth tokens and role helpers', () => {
    saveDevAuthToken('token');
    expect(getDevAuthToken()).toBe('token');
    saveDevAuthToken(null);
    expect(getDevAuthToken()).toBeNull();
    expect(getRoleLabel('ADMIN')).toBe('管理员');
    expect(getRoleLabel('GUEST')).toBe('游客');
    expect(getRoleLabel('USER')).toBe('普通用户');
    expect(hasTradingAccess(user)).toBe(true);
    expect(hasAdminAccess({ ...user, role: 'ADMIN' })).toBe(true);
    expect(isGuestUser({ ...user, role: 'GUEST' })).toBe(true);
  });

  it('subscribes and unsubscribes session change listeners', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSessionChange(listener);
    expect(window.addEventListener).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(window.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('saves current user via convenience helper', () => {
    saveCurrentUser(user);
    expect(getCurrentUser()).toEqual(user);
  });
});
