export type ListingStatusPresentation = {
  label: string;
  tone: 'default' | 'warning' | 'info' | 'success';
};

const listingStatusMap: Record<string, ListingStatusPresentation> = {
  ON_SALE: { label: '在售', tone: 'success' },
  SOLD: { label: '已售', tone: 'default' },
  OFFLINE: { label: '已下架', tone: 'default' },
  OPEN: { label: '可接单', tone: 'warning' },
  BUSY: { label: '名额已满', tone: 'info' },
  PAUSED: { label: '已暂停', tone: 'default' },
  ENDED: { label: '已结束', tone: 'default' },
  MATCHED: { label: '进行中', tone: 'info' },
  DONE: { label: '已完成', tone: 'success' },
  CANCELED: { label: '已取消', tone: 'default' }
};

export function getListingStatusPresentation(status: string, fallbackLabel?: string) {
  return listingStatusMap[status] ?? {
    label: fallbackLabel ?? status,
    tone: 'default'
  };
}
