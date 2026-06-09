import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { EmptyState } from '../components/feedback';
import { useAuthState } from '../services/auth-state';
import { hasAdminAccess, hasTradingAccess } from '../services/session';

type GuardProps = {
  children: ReactElement;
};

export function RequireUser({ children }: GuardProps) {
  const location = useLocation();
  const { currentUser, hydrated } = useAuthState();

  if (!hydrated) {
    return null;
  }

  if (!hasTradingAccess(currentUser)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function RequireAdmin({ children }: GuardProps) {
  const { currentUser, hydrated } = useAuthState();

  if (!hydrated) {
    return null;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: '/admin' }} />;
  }

  if (!hasAdminAccess(currentUser)) {
    return (
      <div className="page-grid">
        <EmptyState className="is-shell" title="当前账号没有后台权限" />
      </div>
    );
  }

  return children;
}
