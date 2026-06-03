const SESSION_KEY = 'swapcampus-demo-user';
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

function normalizeRole(role?: string): AppRole {
  if (role === 'ADMIN') {
    return 'ADMIN';
  }

  if (role === 'GUEST') {
    return 'GUEST';
  }

  return 'USER';
}

export function saveDemoUser(user: DemoUser) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      ...user,
      role: normalizeRole(user.role)
    })
  );
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function getDemoUser(): DemoUser | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DemoUser>;
    if (!parsed.id || !parsed.name) {
      return null;
    }

    return {
      id: parsed.id,
      studentId: parsed.studentId ?? '',
      name: parsed.name,
      email: parsed.email ?? '',
      role: normalizeRole(parsed.role),
      creditScore: parsed.creditScore,
      verified: parsed.verified
    };
  } catch {
    return null;
  }
}

export function clearDemoUser() {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(SESSION_EVENT));
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

export function createAdminDemoUser(): DemoUser {
  return {
    id: 900001,
    studentId: 'ADMIN-001',
    name: '运营管理员',
    email: 'admin@swapcampus.cn',
    role: 'ADMIN',
    creditScore: 100,
    verified: true
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
