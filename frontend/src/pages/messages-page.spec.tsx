import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MessagesPage } from './MessagesPage';

const state = vi.hoisted(() => ({
  location: {
    search: '',
    state: null as any
  }
}));

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  messageError: vi.fn(),
  messageSuccess: vi.fn(),
  fetchConversations: vi.fn(),
  createConversation: vi.fn(),
  fetchConversationMessages: vi.fn(),
  sendConversationMessage: vi.fn(),
  uploadMessageAttachment: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  useAuthState: vi.fn(),
  getAccessToken: vi.fn(),
  io: vi.fn(),
  socket: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn()
  }
}));

function createTradeConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    orderId: 901,
    productId: 55,
    campusServiceOrderId: null,
    campusServiceListing: null,
    campusServiceDisplay: null,
    preview: '你好，在吗？',
    updatedAt: '2026-06-16T10:00:00.000Z',
    latestMessageSenderId: 2,
    latestMessageAt: '2026-06-16T10:00:00.000Z',
    selfRole: 'buyer',
    participant: {
      id: 2,
      displayName: '卖家甲',
      avatarUrl: null,
      avatarFrame: null,
      trustedBadgeUnlocked: true,
      college: '信息学院',
      isSeller: true
    },
    product: {
      id: 55,
      title: '高数教材',
      price: 18,
      category: '教材资料',
      condition: '九成新',
      imageUrl: '/book.png',
      status: 'ON_SALE',
      meetupLocation: '图书馆',
      orderId: 901,
      orderStatus: 'IN_PROGRESS',
      isBuyer: true,
      isSeller: false
    },
    ...overrides
  } as any;
}

function createServiceConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 202,
    orderId: null,
    productId: null,
    campusServiceOrderId: 12,
    campusServiceListing: {
      id: 7,
      title: '代取快递',
      category: 'ERRAND',
      intent: 'REQUEST',
      intentLabel: '需求',
      reward: 8,
      locationFrom: '菜鸟驿站',
      locationTo: '3号宿舍楼',
      deadlineLabel: '今天 18:00',
      estimatedMinutes: 20,
      status: 'MATCHED'
    },
    campusServiceDisplay: null,
    preview: '我已经出发了',
    updatedAt: '2026-06-16T11:00:00.000Z',
    latestMessageSenderId: 3,
    latestMessageAt: '2026-06-16T11:00:00.000Z',
    selfRole: null,
    participant: {
      id: 3,
      displayName: '服务者乙',
      avatarUrl: null,
      avatarFrame: null,
      trustedBadgeUnlocked: false,
      college: '林学院',
      isSeller: false
    },
    product: null,
    ...overrides
  } as any;
}

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      error: mocks.messageError,
      success: mocks.messageSuccess
    }
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({
      pathname: '/messages',
      search: state.location.search,
      state: state.location.state
    })
  };
});

vi.mock('socket.io-client', () => ({
  io: (...args: any[]) => mocks.io(...args)
}));

vi.mock('supertokens-auth-react/recipe/session', () => ({
  default: {
    getAccessToken: () => mocks.getAccessToken()
  }
}));

vi.mock('../services/auth-state', () => ({
  useAuthState: () => mocks.useAuthState()
}));

vi.mock('../services/session', () => ({
  hasTradingAccess: (user: any) => user?.role === 'USER',
  isGuestUser: (user: any) => user?.role === 'GUEST'
}));

vi.mock('../services/api', () => ({
  fetchConversations: () => mocks.fetchConversations(),
  createConversation: (payload: unknown) => mocks.createConversation(payload),
  fetchConversationMessages: (id: number) => mocks.fetchConversationMessages(id),
  sendConversationMessage: (id: number, payload: unknown) => mocks.sendConversationMessage(id, payload),
  uploadMessageAttachment: (file: File) => mocks.uploadMessageAttachment(file),
  getApiErrorMessage: (error: unknown, fallback: string) => mocks.getApiErrorMessage(error, fallback)
}));

vi.mock('../utils/productCover', () => ({
  DEMO_PRODUCT_IMAGE: '/demo-product.png',
  getProductImage: (product: any) => product.imageUrl ?? '/fallback-product.png'
}));

vi.mock('../components/user/UserAvatar', () => ({
  UserAvatar: ({ alt, fallbackLabel }: any) => <span>{alt || fallbackLabel || 'avatar'}</span>
}));

vi.mock('../components/user/UserNameWithBadge', () => ({
  UserNameWithBadge: ({ as: Tag = 'span', name }: any) => <Tag>{name}</Tag>
}));

describe('MessagesPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
    state.location.search = '';
    state.location.state = null;

    mocks.useAuthState.mockReturnValue({
      currentUser: {
        id: 1,
        displayName: '买家本人',
        role: 'USER',
        avatarUrl: '/me.png',
        avatarFrame: null
      }
    });
    mocks.getAccessToken.mockResolvedValue('access-token');
    mocks.fetchConversations.mockResolvedValue([
      createTradeConversation(),
      createServiceConversation()
    ]);
    mocks.fetchConversationMessages.mockImplementation(async (id: number) => (
      id === 202
        ? [
            {
              id: 2001,
              senderId: 3,
              senderName: '服务者乙',
              content: '我已经到楼下',
              type: 'TEXT',
              createdAt: '2026-06-16T11:01:00.000Z'
            }
          ]
        : [
            {
              id: 1001,
              senderId: 2,
              senderName: '卖家甲',
              content: '教材还在',
              type: 'TEXT',
              createdAt: '2026-06-16T10:01:00.000Z'
            },
            {
              id: 1002,
              senderId: 2,
              senderName: '卖家甲',
              content: '',
              type: 'ORDER_EVENT',
              createdAt: '2026-06-16T10:02:00.000Z',
              orderEvent: {
                kind: 'product-order-event',
                event: 'MEETUP_CONFIRMED',
                title: '已确认面交',
                summary: '双方已确认线下面交时间地点',
                orderId: 901,
                productId: 55,
                orderCode: 'ORD-901',
                actionLabel: '查看订单',
                actionTarget: '/orders/901',
                badge: '交易中',
                meta: [{ label: '地点', value: '图书馆' }]
              }
            }
          ]
    ));
    mocks.createConversation.mockResolvedValue({ id: 303, productId: 77, reused: false });
    mocks.sendConversationMessage.mockResolvedValue({
      id: 9999,
      senderId: 1,
      senderName: '买家本人',
      content: '好的',
      type: 'TEXT',
      createdAt: '2026-06-16T11:20:00.000Z'
    });
    mocks.uploadMessageAttachment.mockResolvedValue({
      objectKey: 'message-1',
      url: '/upload-message.png',
      mimeType: 'image/png',
      size: 1234,
      originalName: 'chat.png'
    });
    mocks.getApiErrorMessage.mockImplementation((_error, fallback) => fallback);

    mocks.socket = {
      on: vi.fn((event: string, callback: (...args: any[]) => void) => {
        if (event === 'connect') {
          callback();
        }
        return mocks.socket;
      }),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn()
    };
    mocks.io.mockReturnValue(mocks.socket as any);
  });

  it('shows the guest-state copy for guest users', () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 88, displayName: '游客', role: 'GUEST' }
    });

    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    expect(screen.getByText('游客不可查看私聊')).toBeInTheDocument();
  });

  it('loads conversations, joins sockets, switches channels and sends text and image messages', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('高数教材')).toBeInTheDocument();
    expect(await screen.findByText('教材还在')).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.socket.emit).toHaveBeenCalledWith('message:join', { conversationId: 101 });
      expect(mocks.socket.emit).toHaveBeenCalledWith('message:join', { conversationId: 202 });
    });

    await user.click(screen.getByRole('button', { name: '表情' }));
    await user.click(screen.getByRole('button', { name: '插入表情 🙂' }));
    await user.type(screen.getByPlaceholderText('输入消息…'), '你好');
    await user.click(screen.getByRole('button', { name: /发送$/ }));

    await waitFor(() => {
      expect(mocks.sendConversationMessage).toHaveBeenCalledWith(
        101,
        expect.objectContaining({ content: expect.stringContaining('你好') })
      );
    });

    await user.click(screen.getByRole('tab', { name: /服务/ }));
    expect(await screen.findByText('代取快递')).toBeInTheDocument();

    const imageInput = container.querySelector('input[accept="image/*"]');
    if (!(imageInput instanceof HTMLInputElement)) {
      throw new Error('image input not found');
    }

    const file = new File(['image'], 'chat.png', { type: 'image/png' });
    fireEvent.change(imageInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mocks.uploadMessageAttachment).toHaveBeenCalledWith(file);
      expect(mocks.sendConversationMessage).toHaveBeenCalledWith(
        202,
        expect.objectContaining({
          type: 'IMAGE',
          attachment: expect.objectContaining({ url: '/upload-message.png' })
        })
      );
    });
  });

  it('creates a pending draft conversation and navigates to checkout', async () => {
    state.location.state = {
      draftConversation: {
        productId: 77,
        product: {
          id: 77,
          title: '二手耳机',
          price: 99,
          imageUrl: '/earbuds.png'
        },
        participant: {
          id: 6,
          displayName: '卖家乙',
          college: '工学院',
          trustedBadgeUnlocked: true
        }
      }
    };
    mocks.fetchConversations
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        createTradeConversation({
          id: 303,
          productId: 77,
          product: {
            id: 77,
            title: '二手耳机',
            price: 99,
            category: '数码电子',
            condition: '九成新',
            imageUrl: '/earbuds.png',
            status: 'ON_SALE',
            meetupLocation: '学一食堂',
            orderId: null,
            orderStatus: null,
            isBuyer: false,
            isSeller: false
          }
        })
      ]);
    mocks.fetchConversationMessages.mockResolvedValue([]);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('二手耳机')).toBeInTheDocument();

    await screen.findByPlaceholderText('输入消息…');
    await user.type(screen.getByPlaceholderText('输入消息…'), '我想要');
    await user.click(screen.getByRole('button', { name: /发送$/ }));

    await waitFor(() => {
      expect(mocks.createConversation).toHaveBeenCalledWith({
        productId: 77,
        initialMessage: '我想要'
      });
    });

    await user.click(screen.getByRole('button', { name: '立即下单' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/orders/checkout?type=product&productId=77');
  });
});
