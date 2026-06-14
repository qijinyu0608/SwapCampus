import { Button, Empty, Pagination, Skeleton } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type CampusServiceListItem,
  type CampusServiceOrderListItem,
  fetchCampusServiceOrders,
  getApiErrorMessage
} from '../../services/api';
import { CampusServiceOrderCard } from './CampusServiceOrderCard';

export type PublisherOrderGroupKey = 'PENDING' | 'ACTIVE' | 'WAITING_COMPLETE' | 'ENDED';

export const publisherOrderGroupTabs: Array<{
  key: PublisherOrderGroupKey;
  label: string;
}> = [
  { key: 'PENDING', label: '待确认' },
  { key: 'ACTIVE', label: '进行中' },
  { key: 'WAITING_COMPLETE', label: '待完成确认' },
  { key: 'ENDED', label: '已结束' }
];

type CampusServicePublisherOrderWorkbenchProps = {
  listing: CampusServiceListItem;
  className?: string;
  emptyDescription?: string;
  initialGroup?: PublisherOrderGroupKey;
  reloadVersion?: number;
  onError?: (message: string) => void;
  onConfirmOrder: (order: CampusServiceOrderListItem) => void;
  onRejectOrder: (order: CampusServiceOrderListItem) => void;
  onCompleteOrder: (order: CampusServiceOrderListItem) => void;
  onCancelOrder: (order: CampusServiceOrderListItem) => void;
  actingOrderId?: number | null;
};

export function CampusServicePublisherOrderWorkbench({
  listing,
  className,
  emptyDescription = '当前筛选下还没有相关申请或预约记录。',
  initialGroup = 'PENDING',
  reloadVersion = 0,
  onError,
  onConfirmOrder,
  onRejectOrder,
  onCompleteOrder,
  onCancelOrder,
  actingOrderId
}: CampusServicePublisherOrderWorkbenchProps) {
  const navigate = useNavigate();
  const [group, setGroup] = useState<PublisherOrderGroupKey>(initialGroup);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(6);
  const [total, setTotal] = useState(0);
  const [orders, setOrders] = useState<CampusServiceOrderListItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setGroup(initialGroup);
    setPage(1);
  }, [initialGroup, listing.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      setLoading(true);
      try {
        const result = await fetchCampusServiceOrders({
          listingId: listing.id,
          group,
          page,
          pageSize
        });
        if (!cancelled) {
          setOrders(result.items);
          setPage(result.pagination.page);
          setTotal(result.pagination.total);
        }
      } catch (error) {
        if (!cancelled) {
          setOrders([]);
          setTotal(0);
          onError?.(getApiErrorMessage(error, '申请与预约列表加载失败，请稍后重试。'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOrders();

    return () => {
      cancelled = true;
    };
  }, [group, listing.id, onError, page, pageSize, reloadVersion]);

  const classes = ['service-detail-order-panel', className ?? ''].filter(Boolean).join(' ');
  const totalLabel = useMemo(() => `${total} 单`, [total]);

  return (
    <section className={classes}>
      <div className="service-detail-order-head">
        <div>
          <strong>申请与预约管理</strong>
          <span>查看这条发布下的申请、预约、进行中协作与历史状态。</span>
        </div>
        <em>{totalLabel}</em>
      </div>
      <div className="service-detail-order-tabs" role="tablist" aria-label="订单状态筛选">
        {publisherOrderGroupTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={group === tab.key ? 'active' : undefined}
            onClick={() => {
              setGroup(tab.key);
              setPage(1);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : orders.length ? (
        <>
          <div className="compact-list service-detail-order-list">
            {orders.map((order) => {
              return (
                <CampusServiceOrderCard
                  key={order.id}
                  order={order}
                  actingOrderId={actingOrderId}
                  onOpenConversation={(current) => navigate(`/messages?conversationId=${current.conversationId}`)}
                  onConfirm={onConfirmOrder}
                  onReject={onRejectOrder}
                  onComplete={onCompleteOrder}
                  onCancel={onCancelOrder}
                  layout="full"
                />
              );
            })}
          </div>
          {total > pageSize ? (
            <div className="service-detail-order-pagination">
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                size="small"
                showSizeChanger={false}
                onChange={(nextPage) => setPage(nextPage)}
              />
            </div>
          ) : null}
        </>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={emptyDescription}
        />
      )}
    </section>
  );
}
