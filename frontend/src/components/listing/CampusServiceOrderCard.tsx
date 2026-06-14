import { EnvironmentOutlined, MessageOutlined } from '@ant-design/icons';
import { Button, Tag } from 'antd';
import { UserAvatar, type AvatarFrameKey } from '../user/UserAvatar';
import { OrderPreviewCard, ProfileOrderIdentity } from '../ui';
import { UserNameWithBadge } from '../user/UserNameWithBadge';
import { getUserPresentation } from '../../utils/userPresentation';
import { resolvePrimaryProductImage } from '../../utils/productCover';
import type { CampusServiceOrderListItem } from '../../services/api';

const orderStatusColorMap: Record<CampusServiceOrderListItem['orderStatus'], string> = {
  PENDING_CONFIRMATION: 'orange',
  CONFIRMED: 'blue',
  WAITING_COMPLETE_CONFIRM: 'gold',
  COMPLETED: 'green',
  REJECTED: 'default',
  CANCELED: 'default',
  EXPIRED: 'default'
};

type CampusServiceOrderCardProps = {
  order: CampusServiceOrderListItem;
  actingOrderId?: number | null;
  onOpenConversation?: (order: CampusServiceOrderListItem) => void;
  onConfirm?: (order: CampusServiceOrderListItem) => void;
  onReject?: (order: CampusServiceOrderListItem) => void;
  onComplete?: (order: CampusServiceOrderListItem) => void;
  onCancel?: (order: CampusServiceOrderListItem) => void;
  onViewDetail?: (order: CampusServiceOrderListItem) => void;
  detailButtonLabel?: string;
  layout?: 'full' | 'compact';
};

export function CampusServiceOrderCard({
  order,
  actingOrderId,
  onOpenConversation,
  onConfirm,
  onReject,
  onComplete,
  onCancel,
  onViewDetail,
  detailButtonLabel = '查看详情',
  layout = 'full'
}: CampusServiceOrderCardProps) {
  const counterpartPresentation = getUserPresentation(order.counterpart);
  const isCompact = layout === 'compact';
  const classes = [
    'service-detail-order-card',
    isCompact ? 'is-compact' : ''
  ].filter(Boolean).join(' ');
  const showStatusTag = order.orderStatus !== 'PENDING_CONFIRMATION';
  const canShowConversation = order.actionState.canOpenConversation && order.conversationId && onOpenConversation;
  const canShowConfirm = order.actionState.canConfirm && onConfirm;
  const canShowReject = order.actionState.canReject && onReject;
  const canShowCancel = order.actionState.canCancel && onCancel;
  const canShowComplete = order.actionState.canComplete && onComplete;
  const primaryActionLabel = canShowConfirm
    ? (order.actionLabels.confirm ?? '确认')
    : canShowComplete
      ? (order.actionLabels.complete ?? '提交进度')
      : detailButtonLabel;
  const coverImageSrc = resolvePrimaryProductImage({
    title: order.title,
    category: order.categoryLabel,
    price: order.reward,
    imageUrl: order.imageUrl
  }, order.id);

  if (isCompact) {
    return (
      <OrderPreviewCard
        articleClassName="profile-order-card profile-order-card-list"
        headerProps={{
          copyClassName: 'profile-order-shop-copy',
          actionsClassName: 'profile-order-shop-actions',
          copyContent: (
            <ProfileOrderIdentity
              avatarSrc={order.counterpart.avatarUrl}
              avatarAlt={`${counterpartPresentation.displayName}的头像`}
              fallbackLabel={counterpartPresentation.initial}
              avatarFrame={(counterpartPresentation.avatarFrame as AvatarFrameKey | null) ?? undefined}
              name={counterpartPresentation.displayName}
              statusTag={showStatusTag ? <Tag color={orderStatusColorMap[order.orderStatus]}>{order.orderStatusLabel}</Tag> : undefined}
            />
          ),
          conversationButton: canShowConversation ? (
            <Button
              className="checkout-chat-button is-icon-only"
              onClick={() => onOpenConversation(order)}
              aria-label="查看聊天"
              icon={<MessageOutlined />}
            />
          ) : undefined,
          creditTone: counterpartPresentation.creditBadge.tone,
          creditLabel: counterpartPresentation.creditBadge.label
        }}
        summaryProps={{
          className: 'profile-order-list-item service-order-list-item',
          copyClassName: 'profile-order-item-copy',
          attrsClassName: 'profile-order-item-attrs',
          amountClassName: 'profile-order-item-price service-order-list-price',
          actionsClassName: 'profile-order-list-actions',
          imageSrc: coverImageSrc,
          imageAlt: order.title,
          title: order.title,
          subtitle: <span className="profile-order-product-category">{order.intentLabel} · {order.categoryLabel}</span>,
          attrs: (
            <>
              <span>{order.roleLabel}</span>
              <span>{order.route.label}</span>
              <span>{`预计 ${order.estimatedMinutes} 分钟 · ${order.deadlineLabel}`}</span>
            </>
          ),
          amount: <strong>{order.rewardLabel}</strong>,
          actions: (
            <>
              {canShowCancel ? (
                <Button
                  danger
                  loading={actingOrderId === order.id}
                  onClick={() => onCancel(order)}
                >
                  {order.actionLabels.cancel ?? '取消'}
                </Button>
              ) : null}
              {canShowComplete ? (
                <Button
                  loading={actingOrderId === order.id}
                  onClick={() => onComplete(order)}
                >
                  {order.actionLabels.complete ?? '提交进度'}
                </Button>
              ) : null}
              {canShowConfirm ? (
                <Button
                  type="primary"
                  loading={actingOrderId === order.id}
                  onClick={() => onConfirm(order)}
                >
                  {primaryActionLabel}
                </Button>
              ) : null}
              {canShowReject ? (
                <Button
                  danger
                  loading={actingOrderId === order.id}
                  onClick={() => onReject(order)}
                >
                  {order.actionLabels.reject ?? '拒绝'}
                </Button>
              ) : null}
              {onViewDetail ? (
                <Button type="link" onClick={() => onViewDetail(order)}>
                  {detailButtonLabel}
                </Button>
              ) : null}
            </>
          )
        }}
      />
    );
  }

  return (
    <article className={classes}>
      <div className="service-detail-order-top">
        <div className="service-detail-order-user">
          <UserAvatar
            src={order.counterpart.avatarUrl}
            alt={`${counterpartPresentation.displayName}的头像`}
            fallbackLabel={counterpartPresentation.initial}
            className="profile-order-avatar"
            frame={(counterpartPresentation.avatarFrame as AvatarFrameKey | null) ?? undefined}
          />
          <div>
            <strong>{order.title}</strong>
            {isCompact ? (
              <span className="service-detail-order-subline">
                <em>{order.roleLabel}</em>
                <span className="service-detail-order-dot" aria-hidden="true" />
                <UserNameWithBadge
                  as="span"
                  name={counterpartPresentation.displayName}
                  trustedBadgeUnlocked={counterpartPresentation.trustedBadgeUnlocked}
                />
              </span>
            ) : (
              <em>{order.roleLabel} · 对方 {counterpartPresentation.displayName}</em>
            )}
          </div>
        </div>
        {showStatusTag ? <Tag color={orderStatusColorMap[order.orderStatus]}>{order.orderStatusLabel}</Tag> : null}
      </div>

      <div className="service-detail-order-meta">
        <div>
          <span>方向</span>
          <strong>{order.intentLabel}</strong>
        </div>
        <div>
          <span>分类</span>
          <strong>{order.categoryLabel}</strong>
        </div>
        <div>
          <span>金额</span>
          <strong>{order.rewardLabel}</strong>
        </div>
        <div>
          <span>截止</span>
          <strong>{order.deadlineLabel}</strong>
        </div>
      </div>

      <div className="service-detail-order-inline-meta">
        <div>
          <EnvironmentOutlined />
          <span>{order.route.label}</span>
        </div>
        <div>
          <span>预计 {order.estimatedMinutes} 分钟</span>
          <em>{counterpartPresentation.creditBadge.label}</em>
        </div>
      </div>

      <div className="service-detail-order-actions">
        {canShowConversation ? (
          <Button icon={<MessageOutlined />} onClick={() => onOpenConversation(order)}>
            {order.actionLabels.conversation ?? '看消息'}
          </Button>
        ) : null}
        {canShowConfirm ? (
          <Button
            type="primary"
            loading={actingOrderId === order.id}
            onClick={() => onConfirm(order)}
          >
            {order.actionLabels.confirm ?? '确认'}
          </Button>
        ) : null}
        {canShowReject ? (
          <Button
            danger
            loading={actingOrderId === order.id}
            onClick={() => onReject(order)}
          >
            {order.actionLabels.reject ?? '拒绝'}
          </Button>
        ) : null}
        {canShowCancel ? (
          <Button
            danger
            loading={actingOrderId === order.id}
            onClick={() => onCancel(order)}
          >
            {order.actionLabels.cancel ?? '取消'}
          </Button>
        ) : null}
        {canShowComplete ? (
          <Button
            loading={actingOrderId === order.id}
            onClick={() => onComplete(order)}
          >
            {order.actionLabels.complete ?? '提交进度'}
          </Button>
        ) : null}
        {onViewDetail ? (
          <Button type="primary" onClick={() => onViewDetail(order)}>
            {isCompact && !canShowConfirm && !canShowComplete ? primaryActionLabel : detailButtonLabel}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
