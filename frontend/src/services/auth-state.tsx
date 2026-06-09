import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchCurrentSession } from './api';
import {
  clearCurrentUserStorage,
  getCurrentUser,
  saveCurrentUser,
  subscribeSessionChange,
  type SessionUser
} from './session';

type AuthStateContextValue = {
  currentUser: SessionUser | null;
  hydrated: boolean;
  setCurrentUser: (user: SessionUser | null) => void;
  refreshCurrentUser: () => Promise<SessionUser | null>;
  clearCurrentUser: () => void;
};

const AuthStateContext = createContext<AuthStateContextValue | null>(null);

export function AuthStateProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<SessionUser | null>(() => getCurrentUser());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => subscribeSessionChange(() => {
    setCurrentUserState(getCurrentUser());
  }), []);

  useEffect(() => {
    async function hydrateSession() {
      try {
        const result = await fetchCurrentSession();
        saveCurrentUser(result.user);
        setCurrentUserState(result.user);
      } catch {
        clearCurrentUserStorage();
        setCurrentUserState(null);
      } finally {
        setHydrated(true);
      }
    }

    void hydrateSession();
  }, []);

  const value = useMemo<AuthStateContextValue>(() => ({
    currentUser,
    hydrated,
    setCurrentUser(user) {
      if (!user) {
        clearCurrentUserStorage();
        setCurrentUserState(null);
        return;
      }

      saveCurrentUser(user);
      setCurrentUserState(user);
    },
    async refreshCurrentUser() {
      try {
        const result = await fetchCurrentSession();
        saveCurrentUser(result.user);
        setCurrentUserState(result.user);
        return result.user;
      } catch {
        clearCurrentUserStorage();
        setCurrentUserState(null);
        return null;
      }
    },
    clearCurrentUser() {
      clearCurrentUserStorage();
      setCurrentUserState(null);
    }
  }), [currentUser, hydrated]);

  return <AuthStateContext.Provider value={value}>{children}</AuthStateContext.Provider>;
}

export function useAuthState() {
  const context = useContext(AuthStateContext);
  if (!context) {
    throw new Error('useAuthState must be used within AuthStateProvider');
  }

  return context;
}
