import { addFavorite, fetchFavoriteList, removeFavorite, type FavoriteItem } from './api';
import type { SessionUser } from './session';

const FAVORITES_KEY = 'swapcampus-favorites';
const FAVORITES_EVENT = 'swapcampus:favorites-changed';

type FavoriteMap = Record<string, number[]>;

function resolveScope(user?: SessionUser | null) {
  return user?.id ? String(user.id) : 'guest';
}

function readFavoriteMap(): FavoriteMap {
  const raw = localStorage.getItem(FAVORITES_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as FavoriteMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeFavoriteMap(nextMap: FavoriteMap, scope: string) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(nextMap));
  window.dispatchEvent(new CustomEvent(FAVORITES_EVENT, { detail: { scope } }));
}

function setScopedFavoriteIds(ids: number[], user?: SessionUser | null) {
  const scope = resolveScope(user);
  const map = readFavoriteMap();

  writeFavoriteMap(
    {
      ...map,
      [scope]: Array.from(new Set(ids))
    },
    scope
  );
}

function getGuestFavoriteIds(user?: SessionUser | null) {
  const map = readFavoriteMap();
  return map[resolveScope(user)] ?? [];
}

export function getFavoriteIds(user?: SessionUser | null) {
  return getGuestFavoriteIds(user);
}

export function isFavorite(productId: number, user?: SessionUser | null) {
  return getFavoriteIds(user).includes(productId);
}

export function setFavorite(productId: number, favorited: boolean, user?: SessionUser | null) {
  const currentIds = getGuestFavoriteIds(user);
  const nextIds = favorited
    ? Array.from(new Set([...currentIds, productId]))
    : currentIds.filter((id) => id !== productId);

  setScopedFavoriteIds(nextIds, user);
  return favorited;
}

export function hydrateFavorites(ids: number[], user?: SessionUser | null) {
  setScopedFavoriteIds(ids, user);
}

export async function loadFavorites(user?: SessionUser | null) {
  if (user?.role === 'USER') {
    const result = await fetchFavoriteList();
    const ids = result.items.map((item) => item.id);
    setScopedFavoriteIds(ids, user);
    return result;
  }

  const ids = getGuestFavoriteIds(user);
  return {
    items: [] as FavoriteItem[],
    total: ids.length
  };
}

export async function toggleFavorite(productId: number, user?: SessionUser | null) {
  if (user?.role === 'USER') {
    const currentlyFavorited = isFavorite(productId, user);
    if (currentlyFavorited) {
      const result = await removeFavorite(productId);
      setFavorite(productId, false, user);
      return result.isFavorited;
    }

    const result = await addFavorite(productId);
    setFavorite(productId, true, user);
    return result.isFavorited;
  }

  const nextState = !isFavorite(productId, user);
  return setFavorite(productId, nextState, user);
}

export function subscribeFavorites(listener: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === FAVORITES_KEY) {
      listener();
    }
  };
  const handleLocalChange = () => {
    listener();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(FAVORITES_EVENT, handleLocalChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(FAVORITES_EVENT, handleLocalChange);
  };
}
