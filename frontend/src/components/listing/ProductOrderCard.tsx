import { MessageOutlined } from '@ant-design/icons';
import { Button, Tag } from 'antd';
import { type OrderItem, type ProductSummary } from '../../services/api';
import { formatProductOrderStatus, getProductOrderStatusColor } from '../../utils/orderStatus';
import { getProductImage } from '../../utils/productCover';
import { getUserPresentation } from '../../utils/userPresentation';
import { type AvatarFrameKey } from '../user/UserAvatar';
import { OrderPreviewCard, ProfileOrderIdentity } from '../ui';

type ProductOrderCardProps = {
  order: OrderItem;
  currentUserId?: number;
  imageVariant?: number;
  onOpenConversation?: (order: OrderItem) => void;
  onViewDetail?: (order: OrderItem) => void;
};

export function ProductOrderCard({
  order,
  currentUserId,
  imageVariant = 0,
  onOpenConversation,
  onViewDetail
}: ProductOrderCardProps) {
  const isBuyerView = order.buyerId === currentUserId;
  const counterpartName = isBuyerView ? order.sellerName : order.buyerName;
  const counterpartAvatarUrl = isBuyerView ? order.sellerAvatarUrl : order.buyerAvatarUrl;
  const counterpartAvatarFrame = isBuyerView ? order.sellerAvatarFrame : order.buyerAvatarFrame;
  const counterpartCreditScore = isBuyerView ? order.sellerCreditScore : order.buyerCreditScore;
  const counterpartPresentation = getUserPresentation({
    creditScore: counterpartCreditScore ?? undefined
  });
  const coverImageSrc = order.productImageUrl || getProductImage({
    id: order.productId,
    title: order.productTitle,
    description: '',
    price: order.productPrice ?? 0,
    category: order.productCategory ?? '其他',
    condition: order.productCondition ?? '线下面交',
    sellerName: order.sellerName,
    status: order.productStatus ?? 'ON_SALE',
    tags: []
  } as ProductSummary, imageVariant);

  return (
    <OrderPreviewCard
      articleClassName="profile-order-card profile-order-card-list"
      headerProps={{
        copyClassName: 'profile-order-shop-copy',
        actionsClassName: 'profile-order-shop-actions',
        copyContent: (
          <ProfileOrderIdentity
            avatarSrc={counterpartAvatarUrl}
            avatarAlt={`${counterpartName}的头像`}
            fallbackLabel={counterpartName.slice(0, 1)}
            avatarFrame={(counterpartAvatarFrame as AvatarFrameKey | null) ?? undefined}
            name={counterpartName}
            statusTag={<Tag color={getProductOrderStatusColor(order.status)}>{formatProductOrderStatus(order.status)}</Tag>}
          />
        ),
        conversationButton: order.conversationId && onOpenConversation ? (
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
        className: 'profile-order-list-item',
        copyClassName: 'profile-order-item-copy',
        attrsClassName: 'profile-order-item-attrs',
        amountClassName: 'profile-order-item-price',
        actionsClassName: 'profile-order-list-actions',
        imageSrc: coverImageSrc,
        imageAlt: order.productTitle,
        title: order.productTitle,
        subtitle: <span className="profile-order-product-category">{order.productCategory ?? '校园闲置'}</span>,
        attrs: (
          <>
            <span>成色：{order.productCondition ?? '线下面交'}</span>
            <span>{order.meetupLocation || '待双方约定线下面交时间地点'}</span>
            <span>订单编号：{order.orderCode}</span>
          </>
        ),
        amount: <strong>{order.productPrice === null ? '价格待确认' : `¥${order.productPrice.toFixed(2)}`}</strong>,
        actions: onViewDetail ? (
          <Button type="link" onClick={() => onViewDetail(order)}>
            查看详情
          </Button>
        ) : undefined
      }}
    />
  );
}
