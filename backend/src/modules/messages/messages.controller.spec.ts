import { MessagesController } from './messages.controller';

describe('MessagesController', () => {
  it('delegates message operations', () => {
    const messagesService = {
      listConversations: jest.fn(),
      createConversation: jest.fn(),
      getConversationMessages: jest.fn(),
      sendMessage: jest.fn()
    } as any;
    const controller = new MessagesController(messagesService);
    const user = { id: 1 } as any;
    controller.listConversations(user);
    controller.createConversation({ listingId: 2 } as any, user);
    controller.getConversationMessages(3, user);
    controller.sendMessage(3, { content: 'hi' } as any, user);
    expect(messagesService.listConversations).toHaveBeenCalledWith(user);
    expect(messagesService.createConversation).toHaveBeenCalledWith({ listingId: 2 }, user);
    expect(messagesService.getConversationMessages).toHaveBeenCalledWith(3, user);
    expect(messagesService.sendMessage).toHaveBeenCalledWith(3, { content: 'hi' }, user);
  });
});
