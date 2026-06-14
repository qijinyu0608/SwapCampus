export const messageConversationAccessInclude = {
  campusServiceOrder: {
    select: {
      requesterId: true,
      providerId: true,
      listing: {
        select: {
          ownerId: true
        }
      }
    }
  },
  order: true,
  messages: {
    select: {
      senderId: true
    }
  }
} as const;

export type MessageConversationAccessRecord = {
  productId: number | null;
  initiatorId: number | null;
  order: {
    buyerId: number;
    sellerId: number;
  } | null;
  campusServiceOrder: {
    requesterId: number;
    providerId: number;
    listing: {
      ownerId: number;
    } | null;
  } | null;
  messages: Array<{
    senderId: number;
  }>;
};

export type ResolvedCampusConversationParticipants = {
  publisherId: number | null;
  participantId: number | null;
  requesterId: number | null;
  providerId: number | null;
  listingOwnerId: number | null;
};

export function resolveCampusConversationParticipants(
  conversation: Pick<MessageConversationAccessRecord, 'campusServiceOrder'>
): ResolvedCampusConversationParticipants {
  const requesterId = conversation.campusServiceOrder?.requesterId ?? null;
  const providerId = conversation.campusServiceOrder?.providerId ?? null;
  const listingOwnerId = conversation.campusServiceOrder?.listing?.ownerId ?? null;
  const derivedParticipantId = conversation.campusServiceOrder
    ? (listingOwnerId === requesterId ? providerId : requesterId)
    : null;

  return {
    publisherId: listingOwnerId,
    participantId: derivedParticipantId,
    requesterId,
    providerId,
    listingOwnerId
  };
}

export function collectConversationParticipantIds(params: {
  conversation: MessageConversationAccessRecord;
  productSellerId?: number | null;
}) {
  const { conversation, productSellerId = null } = params;
  const participantIds = new Set<number>();
  const campusParticipants = resolveCampusConversationParticipants(conversation);

  if (conversation.order?.buyerId) {
    participantIds.add(conversation.order.buyerId);
  }

  if (conversation.order?.sellerId) {
    participantIds.add(conversation.order.sellerId);
  }

  if (productSellerId) {
    participantIds.add(productSellerId);
  }

  if (conversation.initiatorId) {
    participantIds.add(conversation.initiatorId);
  }

  if (campusParticipants.publisherId) {
    participantIds.add(campusParticipants.publisherId);
  }

  if (campusParticipants.participantId) {
    participantIds.add(campusParticipants.participantId);
  }

  if (campusParticipants.requesterId) {
    participantIds.add(campusParticipants.requesterId);
  }

  if (campusParticipants.providerId) {
    participantIds.add(campusParticipants.providerId);
  }

  if (campusParticipants.listingOwnerId) {
    participantIds.add(campusParticipants.listingOwnerId);
  }

  conversation.messages.forEach((message) => {
    participantIds.add(message.senderId);
  });

  return participantIds;
}
