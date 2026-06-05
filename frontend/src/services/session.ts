const SESSION_KEY = 'swapcampus-session';
const SESSION_EVENT = 'swapcampus-session-change';

export type AppRole = 'GUEST' | 'USER' | 'ADMIN';

export type DemoUser = {
  id: number;
  studentId: string;
  name: string;
  email: string;
  role: AppRole;
  creditScore?: number;
  verified?: boolean;
};

export type AppSession = {
  accessToken: string | null;
  user: DemoUser;
};

type StoredSession = {
  accessToken: string | null;
  user: DemoUser;
};

function normalizeRole(role?: string): AppRole {
  if (role === 'ADMIN') {
    return 'ADMIN';
  }

  if (role === 'GUEST') {
    return 'GUEST';
  }

  return 'USER';
}

function normalizeUser(user: Partial<DemoUser>): DemoUser | null {
  if (!user.id || !user.name) {
    return null;
  }

  return {
    id: user.id,
    studentId: user.studentId ?? '',
    name: user.name,
    email: user.email ?? '',
    role: normalizeRole(user.role),
    creditScore: user.creditScore,
    verified: user.verified
  };
}

function dispatchSessionChange() {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function saveSession(session: { accessToken?: string | null; user: DemoUser }) {
  const normalizedUser = normalizeUser(session.user);
  if (!normalizedUser) {
    return;
  }

  const nextSession: StoredSession = {
    accessToken: session.accessToken?.trim() || null,
    user: normalizedUser
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  dispatchSessionChange();
}

export function saveDemoUser(user: DemoUser) {
  const current = getSession();
  saveSession({
    accessToken: current?.accessToken ?? null,
    user
  });
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

    return {
      accessToken: typeof parsed.accessToken === 'string' && parsed.accessToken.trim()
        ? parsed.accessToken
        : null,
      user
    };
  } catch {
    return null;
  }
}

export function getDemoUser(): DemoUser | null {
  return getSession()?.user ?? null;
}

export function getAccessToken() {
  return getSession()?.accessToken ?? null;
}

export function clearDemoUser() {
  localStorage.removeItem(SESSION_KEY);
  dispatchSessionChange();
}

export function createGuestUser(): DemoUser {
  const guestId = Date.now();
  return {
    id: guestId,
    studentId: `guest-${String(guestId).slice(-6)}`,
    name: '游客',
    email: '',
    role: 'GUEST',
    creditScore: 0,
    verified: false
  };
}

export function getRoleLabel(role?: AppRole) {
  if (role === 'ADMIN') {
    return '管理员';
  }

  if (role === 'GUEST') {
    return '游客';
  }

  return '普通用户';
}

export function hasTradingAccess(user: DemoUser | null) {
  return user?.role === 'USER';
}

export function hasAdminAccess(user: DemoUser | null) {
  return user?.role === 'ADMIN';
}

export function isGuestUser(user: DemoUser | null) {
  return user?.role === 'GUEST';
}

export function subscribeSessionChange(listener: () => void) {
  window.addEventListener(SESSION_EVENT, listener);
  return () => window.removeEventListener(SESSION_EVENT, listener);
}
