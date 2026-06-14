import { followUser, getApiErrorMessage, unfollowUser } from '../services/api';

type ToggleFollowOptions = {
  targetUserId: number;
  isFollowing: boolean;
  setPending: (value: boolean) => void;
  onSuccess: (result: Awaited<ReturnType<typeof followUser>>) => void;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  successMessage?: {
    follow: string;
    unfollow: string;
  };
  fallbackErrorMessage?: string;
  onFinally?: () => void;
};

export async function executeToggleFollow(options: ToggleFollowOptions) {
  const {
    targetUserId,
    isFollowing,
    setPending,
    onSuccess,
    notifySuccess,
    notifyError,
    successMessage = {
      follow: '已关注',
      unfollow: '已取消关注'
    },
    fallbackErrorMessage = '关注操作失败',
    onFinally
  } = options;

  setPending(true);
  try {
    const result = isFollowing
      ? await unfollowUser(targetUserId)
      : await followUser(targetUserId);
    onSuccess(result);
    notifySuccess(result.isFollowing ? successMessage.follow : successMessage.unfollow);
  } catch (error) {
    notifyError(getApiErrorMessage(error, fallbackErrorMessage));
  } finally {
    setPending(false);
    onFinally?.();
  }
}
