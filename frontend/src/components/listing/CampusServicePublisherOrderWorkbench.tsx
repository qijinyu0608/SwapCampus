import { MessageOutlined } from '@ant-design/icons';
import { Button, Empty, Pagination, Skeleton, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type CampusServiceListItem,
  type CampusServiceOrderListItem,
  fetchCampusServiceOrders,
  getApiErrorMessage
} from '../../services/api';
import { getUserPresentation } from '../../utils/userPresentation';

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

const orderStatusColorMap: Record<CampusServiceOrderListItem['orderStatus'], string> = {
  PENDING_CONFIRMATION: 'orange',
  CONFIRMED: 'blue',
  WAITING_COMPLETE_CONFIRM: 'gold',
  COMPLETED: 'green',
  REJECTED: 'default',
  CANCELED: 'default',
  EXPIRED: 'default'
};

export function CampusServicePublisherOrderWorkbench({
  listing,
  className,
  emptyDescription = '当前筛选下还没有相关服务单。',
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
          onError?.(getApiErrorMessage(error, '服务单列表加载失败，请稍后重试。'));
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
          <strong>订单管理</strong>
          <span>查看这条发布下的申请、进行中服务单与历史状态。</span>
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
              const counterpartPresentation = getUserPresentation(order.counterpart);

              return (
                <article key={order.id} className="service-detail-order-card">
                  <div className="service-detail-order-top">
                    <div className="service-detail-order-user">
                      <span>{counterpartPresentation.initial}</span>
                      <div>
                        <strong>{counterpartPresentation.displayName}</strong>
                        <em>{order.roleLabel} · {order.intentLabel}</em>
                      </div>
                    </div>
                    <Tag color={orderStatusColorMap[order.orderStatus]}>{order.orderStatusLabel}</Tag>
                  </div>

                  <div className="service-detail-order-meta">
                    <div>
                      <span>金额</span>
                      <strong>{order.rewardLabel}</strong>
                    </div>
                    <div>
                      <span>地点</span>
                      <strong>{order.route.label}</strong>
                    </div>
                    <div>
                      <span>截止</span>
                      <strong>{order.deadlineLabel}</strong>
                    </div>
                    <div>
                      <span>预计</span>
                      <strong>{order.estimatedMinutes} 分钟</strong>
                    </div>
                  </div>

                  <div className="service-detail-order-actions">
                    {order.actionState.canOpenConversation && order.conversationId ? (
                      <Button icon={<MessageOutlined />} onClick={() => navigate(`/messages?conversationId=${order.conversationId}`)}>
                        {order.actionLabels.conversation ?? '看消息'}
                      </Button>
                    ) : null}
                    {order.actionState.canConfirm ? (
                      <Button
                        type="primary"
                        loading={actingOrderId === order.id}
                        onClick={() => onConfirmOrder(order)}
                      >
                        {order.actionLabels.confirm ?? '确认'}
                      </Button>
                    ) : null}
                    {order.actionState.canReject ? (
                      <Button
                        danger
                        loading={actingOrderId === order.id}
                        onClick={() => onRejectOrder(order)}
                      >
                        {order.actionLabels.reject ?? '拒绝'}
                      </Button>
                    ) : null}
                    {order.actionState.canComplete ? (
                      <Button
                        loading={actingOrderId === order.id}
                        onClick={() => onCompleteOrder(order)}
                      >
                        {order.actionLabels.complete ?? '提交完成'}
                      </Button>
                    ) : null}
                    {order.actionState.canCancel ? (
                      <Button
                        danger
                        loading={actingOrderId === order.id}
                        onClick={() => onCancelOrder(order)}
                      >
                        {order.actionLabels.cancel ?? '取消'}
                      </Button>
                    ) : null}
                  </div>
                </article>
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
