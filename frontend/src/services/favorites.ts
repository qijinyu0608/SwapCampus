import { DemoUser } from './session';

const FAVORITES_KEY = 'swapcampus-favorites';
const FAVORITES_EVENT = 'swapcampus:favorites-changed';

type FavoriteMap = Record<string, number[]>;

function resolveScope(user?: DemoUser | null) {
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

export function getFavoriteIds(user?: DemoUser | null) {
  const map = readFavoriteMap();
  return map[resolveScope(user)] ?? [];
}

export function isFavorite(productId: number, user?: DemoUser | null) {
  return getFavoriteIds(user).includes(productId);
}

export function setFavorite(productId: number, favorited: boolean, user?: DemoUser | null) {
  const scope = resolveScope(user);
  const map = readFavoriteMap();
  const currentIds = map[scope] ?? [];
  const nextIds = favorited
    ? Array.from(new Set([...currentIds, productId]))
    : currentIds.filter((id) => id !== productId);

  writeFavoriteMap(
    {
      ...map,
      [scope]: nextIds
    },
    scope
  );

  return favorited;
}

export function toggleFavorite(productId: number, user?: DemoUser | null) {
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
