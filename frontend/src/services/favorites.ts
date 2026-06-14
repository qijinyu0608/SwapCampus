import { addFavorite, fetchFavoriteList, fetchProducts, removeFavorite, type FavoriteItem } from './api';
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

function getScopedFavoriteIdsByScope(scope: string) {
  const map = readFavoriteMap();
  return map[scope] ?? [];
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
  return getScopedFavoriteIdsByScope(resolveScope(user));
}

function clearScopedFavoriteIds(scope: string) {
  const map = readFavoriteMap();
  if (!(scope in map)) {
    return;
  }

  const nextMap = { ...map };
  delete nextMap[scope];
  writeFavoriteMap(nextMap, scope);
}

async function buildFallbackFavoriteItems(ids: number[]) {
  if (!ids.length) {
    return [] as FavoriteItem[];
  }

  const orderMap = new Map(ids.map((id, index) => [id, index]));
  const result = await fetchProducts({
    ids,
    status: 'ALL',
    page: 1,
    pageSize: ids.length
  });

  return result.items
    .sort((left, right) => (orderMap.get(left.id) ?? 0) - (orderMap.get(right.id) ?? 0))
    .map((item) => ({
      ...item,
      favoritedAt: item.favoritedAt ?? '',
      favoriteCount: item.favoriteCount ?? 0,
      isFavorited: true as const
    }));
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
    const userScope = resolveScope(user);
    const localIds = Array.from(
      new Set([
        ...getScopedFavoriteIdsByScope('guest'),
        ...getScopedFavoriteIdsByScope(userScope)
      ])
    );

    let result = await fetchFavoriteList();
    let serverItems = result.items;
    let serverIds = new Set(serverItems.map((item) => item.id));
    const missingLocalIds = localIds.filter((id) => !serverIds.has(id));

    if (missingLocalIds.length) {
      const syncResults = await Promise.allSettled(missingLocalIds.map((id) => addFavorite(id)));
      const syncedCount = syncResults.filter((item) => item.status === 'fulfilled').length;

      if (syncedCount > 0) {
        result = await fetchFavoriteList();
        serverItems = result.items;
        serverIds = new Set(serverItems.map((item) => item.id));
      }
    }

    const unresolvedLocalIds = localIds.filter((id) => !serverIds.has(id));
    const fallbackItems = await buildFallbackFavoriteItems(unresolvedLocalIds);
    const items = [...serverItems, ...fallbackItems];
    const ids = items.map((item) => item.id);

    setScopedFavoriteIds(ids, user);
    clearScopedFavoriteIds('guest');

    return {
      items,
      total: items.length
    };
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
