import { CampusServiceCategory, CampusServiceIntent } from '@prisma/client';

export const LOCAL_CAMPUS_SERVICE_IMAGES: Record<CampusServiceCategory, readonly string[]> = {
  ERRAND: ['/images/campus-services/errand.svg'],
  AGENCY: ['/images/campus-services/agency.svg'],
  GROUP_BUY: ['/images/campus-services/group-buy.svg'],
  MOVING: ['/images/campus-services/moving.svg'],
  TUTORING: ['/images/campus-services/tutoring.svg'],
  SKILL: ['/images/campus-services/skill.svg'],
  REPAIR: ['/images/campus-services/repair.svg'],
  EVENT: ['/images/campus-services/event.svg'],
  OTHER: ['/images/campus-services/other.svg'],
  HELP: ['/images/campus-services/help.svg']
};

function stableHash(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getLocalCampusServiceImage(
  category: CampusServiceCategory,
  variant = 0
) {
  const pool = LOCAL_CAMPUS_SERVICE_IMAGES[category] ?? LOCAL_CAMPUS_SERVICE_IMAGES.OTHER;
  return pool[variant % pool.length];
}

export function resolveLocalCampusServiceImage(params: {
  category: CampusServiceCategory;
  intent?: CampusServiceIntent | null;
  listingId?: number | null;
  title?: string | null;
  imageUrl?: string | null;
}) {
  const seed = [
    params.category,
    params.intent ?? '',
    String(params.listingId ?? ''),
    params.title ?? '',
    params.imageUrl ?? ''
  ].join('|');

  return getLocalCampusServiceImage(params.category, stableHash(seed));
}
