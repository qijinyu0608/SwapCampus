export type ListingStatusPresentation = {
  label: string;
  tone: 'default' | 'warning' | 'info' | 'success';
};

const listingStatusMap: Record<string, ListingStatusPresentation> = {
  ON_SALE: { label: '在售', tone: 'success' },
  PENDING: { label: '审核中', tone: 'warning' },
  SOLD: { label: '已售', tone: 'default' },
  OFFLINE: { label: '已下架', tone: 'default' },
  OPEN: { label: '待接单', tone: 'warning' },
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
