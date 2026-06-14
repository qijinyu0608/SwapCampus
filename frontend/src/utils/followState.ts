import { fetchUserTrustSummary } from '../services/api';
import { isGuestUser, type SessionUser } from '../services/session';

type LoadFollowStateOptions = {
  currentUser: SessionUser | null;
  targetUserId?: number | null;
  reset: () => void;
  apply: (isFollowing: boolean) => void;
};

export async function loadFollowStateForTarget({
  currentUser,
  targetUserId,
  reset,
  apply
}: LoadFollowStateOptions) {
  reset();

  if (!currentUser || !targetUserId || isGuestUser(currentUser) || currentUser.id === targetUserId) {
    return;
  }

  try {
    const summary = await fetchUserTrustSummary(targetUserId);
    apply(summary.isFollowing);
  } catch {
    // ignore
  }
}
