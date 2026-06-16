export const CAMPUS_SERVICE_LOCAL_IMAGES = {
  ERRAND: '/images/campus-services/errand.svg',
  AGENCY: '/images/campus-services/agency.svg',
  GROUP_BUY: '/images/campus-services/group-buy.svg',
  MOVING: '/images/campus-services/moving.svg',
  TUTORING: '/images/campus-services/tutoring.svg',
  SKILL: '/images/campus-services/skill.svg',
  REPAIR: '/images/campus-services/repair.svg',
  EVENT: '/images/campus-services/event.svg',
  OTHER: '/images/campus-services/other.svg',
  HELP: '/images/campus-services/help.svg'
};

export function getCampusServiceLocalImage(category) {
  return CAMPUS_SERVICE_LOCAL_IMAGES[category] ?? CAMPUS_SERVICE_LOCAL_IMAGES.OTHER;
}
