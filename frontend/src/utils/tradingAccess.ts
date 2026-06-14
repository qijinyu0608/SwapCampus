import type { NavigateFunction } from 'react-router-dom';
import type { SessionUser } from '../services/session';
import { hasTradingAccess, isGuestUser } from '../services/session';

type EnsureTradingAccessOptions = {
  currentUser: SessionUser | null;
  actionLabel: string;
  navigate: NavigateFunction;
  notifyError: (message: string) => void;
};

export function ensureTradingAccessOrNotify({
  currentUser,
  actionLabel,
  navigate,
  notifyError
}: EnsureTradingAccessOptions) {
  if (!currentUser) {
    notifyError(`请先登录后再${actionLabel}`);
    void navigate('/login');
    return false;
  }

  if (isGuestUser(currentUser)) {
    notifyError(`浏览账号不可${actionLabel}`);
    void navigate('/login');
    return false;
  }

  if (!hasTradingAccess(currentUser)) {
    notifyError(`当前账号不可${actionLabel}`);
    return false;
  }

  return true;
}
