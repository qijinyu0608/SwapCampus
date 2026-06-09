import { useEffect, useMemo, useState } from 'react';
import { fetchUserProfile, fetchUserTrustSummary, getApiErrorMessage, type UserProfile, type UserTrustSummary } from './api';
import { type SessionUser } from './session';
import { getUserPresentation, type UserPresentationModel } from '../utils/userPresentation';

export type CurrentUserProfileBundle = {
  profile: UserProfile | null;
  trustSummary: UserTrustSummary | null;
  presentation: UserPresentationModel;
  creditScore: number;
};

export function buildCurrentUserProfileBundle(input: {
  currentUser?: SessionUser | null;
  profile?: UserProfile | null;
  trustSummary?: UserTrustSummary | null;
}): CurrentUserProfileBundle {
  const source = input.trustSummary ?? input.profile ?? input.currentUser ?? null;
  const presentation = getUserPresentation(source);

  return {
    profile: input.profile ?? null,
    trustSummary: input.trustSummary ?? null,
    presentation,
    creditScore: input.trustSummary?.creditScore ?? input.profile?.creditScore ?? input.currentUser?.creditScore ?? presentation.creditScore
  };
}

export function useCurrentUserProfileBundle(currentUser?: SessionUser | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trustSummary, setTrustSummary] = useState<UserTrustSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function load() {
      if (!currentUser?.id) {
        setProfile(null);
        setTrustSummary(null);
        setErrorMessage('');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [profileResult, trustResult] = await Promise.all([
          fetchUserProfile(currentUser.id),
          fetchUserTrustSummary(currentUser.id)
        ]);
        setProfile(profileResult);
        setTrustSummary(trustResult);
        setErrorMessage('');
      } catch (error) {
        setProfile(null);
        setTrustSummary(null);
        setErrorMessage(getApiErrorMessage(error, '个人资料加载失败'));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [currentUser?.id]);

  const bundle = useMemo(
    () => buildCurrentUserProfileBundle({ currentUser, profile, trustSummary }),
    [currentUser, profile, trustSummary]
  );

  return {
    ...bundle,
    loading,
    errorMessage,
    setProfile,
    setTrustSummary
  };
}
