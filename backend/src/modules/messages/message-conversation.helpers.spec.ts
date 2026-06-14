import {
  collectConversationParticipantIds,
  resolveCampusConversationParticipants,
  type MessageConversationAccessRecord
} from './message-conversation.helpers';

describe('message conversation helpers', () => {
  it('should resolve campus participants from listing and order', () => {
    const result = resolveCampusConversationParticipants({
      campusServiceOrder: {
        requesterId: 11,
        providerId: 22,
        listing: {
          ownerId: 11
        }
      }
    });

    expect(result).toEqual({
      publisherId: 11,
      participantId: 22,
      requesterId: 11,
      providerId: 22,
      listingOwnerId: 11
    });
  });

  it('should resolve offer listing participant from requester side', () => {
    const result = resolveCampusConversationParticipants({
      campusServiceOrder: {
        requesterId: 55,
        providerId: 44,
        listing: {
          ownerId: 44
        }
      }
    });

    expect(result).toEqual({
      publisherId: 44,
      participantId: 55,
      requesterId: 55,
      providerId: 44,
      listingOwnerId: 44
    });
  });

  it('should collect unique participant ids across order, campus service and message actors', () => {
    const participantIds = collectConversationParticipantIds({
      productSellerId: 88,
      conversation: {
        productId: 99,
        initiatorId: 31,
        order: {
          buyerId: 31,
          sellerId: 88
        },
        campusServiceOrder: {
          requesterId: 11,
          providerId: 22,
          listing: {
            ownerId: 11
          }
        },
        messages: [
          { senderId: 22 },
          { senderId: 77 }
        ]
      } satisfies MessageConversationAccessRecord
    });

    expect(Array.from(participantIds).sort((left, right) => left - right)).toEqual([11, 22, 31, 77, 88]);
  });
});
