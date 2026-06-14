import type { AuthUser } from './api';

const SESSION_KEY = 'swapcampus-session';
const SESSION_EVENT = 'swapcampus-session-change';
const DEV_AUTH_TOKEN_KEY = 'swapcampus-dev-auth-token';

export type SessionRole = 'GUEST' | 'USER' | 'ADMIN';
export type SessionUser = Omit<AuthUser, 'role'> & {
  role: SessionRole;
};

export type AppSession = {
  user: SessionUser;
};

type StoredSession = {
  user: SessionUser;
};

function normalizeRole(role?: string): SessionRole {
  if (role === 'ADMIN') {
    return 'ADMIN';
  }

  if (role === 'GUEST') {
    return 'GUEST';
  }

  return 'USER';
}

function normalizeUser(user: Partial<SessionUser>): SessionUser | null {
  if (!user.id || !user.displayName) {
    return null;
  }

  return {
    id: user.id,
    studentId: user.studentId ?? '',
    displayName: user.displayName,
    email: user.email ?? '',
    avatarUrl: user.avatarUrl ?? null,
    avatarFrame: user.avatarFrame ?? null,
    avatarFrameUnlocked: user.avatarFrameUnlocked ?? false,
    role: normalizeRole(user.role),
    creditScore: user.creditScore,
    verificationStatus: user.verificationStatus,
    accountStatus: user.accountStatus
  };
}

function dispatchSessionChange() {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function saveSession(session: { user: SessionUser }) {
  const normalizedUser = normalizeUser(session.user);
  if (!normalizedUser) {
    return;
  }

  const nextSession: StoredSession = {
    user: normalizedUser
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  dispatchSessionChange();
}

export function saveCurrentUser(user: SessionUser) {
  saveSession({ user });
}

export function getSession(): AppSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    const user = normalizeUser(parsed.user ?? {});
    if (!user) {
      return null;
    }

    return { user };
  } catch {
    return null;
  }
}

export function getCurrentUser(): SessionUser | null {
  return getSession()?.user ?? null;
}

export function clearCurrentUserStorage() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(DEV_AUTH_TOKEN_KEY);
  dispatchSessionChange();
}

export function saveDevAuthToken(token: string | null) {
  if (!token) {
    localStorage.removeItem(DEV_AUTH_TOKEN_KEY);
    dispatchSessionChange();
    return;
  }

  localStorage.setItem(DEV_AUTH_TOKEN_KEY, token);
  dispatchSessionChange();
}

export function getDevAuthToken() {
  return localStorage.getItem(DEV_AUTH_TOKEN_KEY);
}

export function getRoleLabel(role?: SessionRole) {
  if (role === 'ADMIN') {
    return '管理员';
  }

  if (role === 'GUEST') {
    return '游客';
  }

  return '普通用户';
}

export function hasTradingAccess(user: SessionUser | null) {
  return user?.role === 'USER';
}

export function hasAdminAccess(user: SessionUser | null) {
  return user?.role === 'ADMIN';
}

export function isGuestUser(user: SessionUser | null) {
  return user?.role === 'GUEST';
}

export function subscribeSessionChange(listener: () => void) {
  window.addEventListener(SESSION_EVENT, listener);
  return () => window.removeEventListener(SESSION_EVENT, listener);
}
