import { recordRecommendationBehavior, type BehaviorEventType, type ProductDetail, type ProductSummary } from './api';
import type { DemoUser } from './session';

const BEHAVIOR_KEY = 'swapcampus-behavior';
const BEHAVIOR_EVENT = 'swapcampus:behavior-changed';
const MAX_RECENT_VIEWS = 24;

type ProductSignal = {
  id: number;
  category: string;
  tags: string[];
  viewedAt?: number;
};

type ScopedBehavior = {
  recentlyViewed: ProductSignal[];
  favorites: Record<string, ProductSignal>;
};

type BehaviorMap = Record<string, ScopedBehavior>;

export type BehaviorProfile = {
  viewedProductIds: number[];
  favoriteProductIds: number[];
  categoryWeights: Record<string, number>;
  tagWeights: Record<string, number>;
};

function resolveScope(user?: DemoUser | null) {
  return user?.id ? String(user.id) : 'guest';
}

function normalizeSignal(product: Pick<ProductSummary, 'id' | 'category' | 'tags'>): ProductSignal {
  return {
    id: product.id,
    category: product.category,
    tags: Array.from(new Set(product.tags.filter(Boolean)))
  };
}

function readBehaviorMap(): BehaviorMap {
  const raw = localStorage.getItem(BEHAVIOR_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as BehaviorMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeBehaviorMap(nextMap: BehaviorMap, scope: string) {
  localStorage.setItem(BEHAVIOR_KEY, JSON.stringify(nextMap));
  window.dispatchEvent(new CustomEvent(BEHAVIOR_EVENT, { detail: { scope } }));
}

function getScopedBehavior(user?: DemoUser | null): ScopedBehavior {
  const map = readBehaviorMap();
  return map[resolveScope(user)] ?? { recentlyViewed: [], favorites: {} };
}

export function recordProductView(product: Pick<ProductDetail, 'id' | 'category' | 'tags'>, user?: DemoUser | null) {
  const scope = resolveScope(user);
  const map = readBehaviorMap();
  const current = map[scope] ?? { recentlyViewed: [], favorites: {} };
  const signal = normalizeSignal(product);
  const nextViewed = [
    { ...signal, viewedAt: Date.now() },
    ...current.recentlyViewed.filter((item) => item.id !== product.id)
  ].slice(0, MAX_RECENT_VIEWS);

  writeBehaviorMap(
    {
      ...map,
      [scope]: {
        ...current,
        recentlyViewed: nextViewed
      }
    },
    scope
  );

  if (user?.role === 'USER') {
    void recordRecommendationBehavior({
      productId: product.id,
      eventType: 'VIEW'
    }).catch(() => undefined);
  }
}

export function syncFavoriteSignal(
  product: Pick<ProductSummary, 'id' | 'category' | 'tags'>,
  favorited: boolean,
  user?: DemoUser | null
) {
  const scope = resolveScope(user);
  const map = readBehaviorMap();
  const current = map[scope] ?? { recentlyViewed: [], favorites: {} };
  const nextFavorites = { ...current.favorites };

  if (favorited) {
    nextFavorites[String(product.id)] = normalizeSignal(product);
  } else {
    delete nextFavorites[String(product.id)];
  }

  writeBehaviorMap(
    {
      ...map,
      [scope]: {
        ...current,
        favorites: nextFavorites
      }
    },
    scope
  );

  if (user?.role === 'USER') {
    const eventType: BehaviorEventType = favorited ? 'FAVORITE' : 'UNFAVORITE';
    void recordRecommendationBehavior({
      productId: product.id,
      eventType
    }).catch(() => undefined);
  }
}

export function getBehaviorProfile(user?: DemoUser | null): BehaviorProfile {
  const scoped = getScopedBehavior(user);
  const categoryWeights: Record<string, number> = {};
  const tagWeights: Record<string, number> = {};
  const favoriteSignals = Object.values(scoped.favorites);

  scoped.recentlyViewed.forEach((item, index) => {
    const recencyWeight = Math.max(2, 8 - index * 0.25);
    categoryWeights[item.category] = (categoryWeights[item.category] ?? 0) + recencyWeight;
    item.tags.forEach((tag) => {
      tagWeights[tag] = (tagWeights[tag] ?? 0) + recencyWeight * 0.8;
    });
  });

  favoriteSignals.forEach((item) => {
    categoryWeights[item.category] = (categoryWeights[item.category] ?? 0) + 14;
    item.tags.forEach((tag) => {
      tagWeights[tag] = (tagWeights[tag] ?? 0) + 9;
    });
  });

  return {
    viewedProductIds: scoped.recentlyViewed.map((item) => item.id),
    favoriteProductIds: favoriteSignals.map((item) => item.id),
    categoryWeights,
    tagWeights
  };
}

export function subscribeBehavior(listener: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === BEHAVIOR_KEY) {
      listener();
    }
  };

  const handleLocalChange = () => {
    listener();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(BEHAVIOR_EVENT, handleLocalChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(BEHAVIOR_EVENT, handleLocalChange);
  };
}
