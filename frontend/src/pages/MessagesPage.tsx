import {
  EnvironmentOutlined,
  FieldTimeOutlined,
  MoreOutlined,
  PictureOutlined,
  ScissorOutlined,
  SendOutlined,
  ShopOutlined,
  SmileOutlined
} from '@ant-design/icons';
import { Empty, Input, message } from 'antd';
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import {
  ConversationMessage,
  ConversationSummary,
  fetchConversationMessages,
  fetchConversations,
  getApiErrorMessage,
  hydrateMessageDemos,
  sendConversationMessage
} from '../services/api';
import { getDemoUser, hasTradingAccess, isGuestUser, saveDemoUser } from '../services/session';
import { getProductImage } from '../utils/productCover';

const READ_STORAGE_PREFIX = 'swapcampus-message-read-map:';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

type NewMessageEvent = {
  conversationId: number;
  message: ConversationMessage;
};

type MessageChannel = 'trade' | 'service';

function formatSessionTime(input: string) {
  const target = new Date(input);
  const now = new Date();
  const diff = now.getTime() - target.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (target.toDateString() === now.toDateString()) {
    if (hours >= 1) {
      return `${hours}小时前`;
    }

    const minutes = Math.max(1, Math.floor(diff / (1000 * 60)));
    return `${minutes}分钟前`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (target.toDateString() === yesterday.toDateString()) {
    return '昨天';
  }

  return `${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
}

function formatDividerLabel(input: string) {
  const target = new Date(input);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`;

  if (target.toDateString() === now.toDateString()) {
    return `今天 ${time}`;
  }

  if (target.toDateString() === yesterday.toDateString()) {
    return `昨天 ${time}`;
  }

  return `${target.getFullYear()}/${target.getMonth() + 1}/${target.getDate()} ${time}`;
}

function formatBubbleTime(input: string) {
  const target = new Date(input);
  return `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`;
}

function isSameDay(left: string, right: string) {
  return new Date(left).toDateString() === new Date(right).toDateString();
}

function getAvatarMeta(name: string) {
  const palettes = [
    ['#72c6ef', '#004e92'],
    ['#ffd66b', '#ff9a00'],
    ['#97f6c4', '#22a06b'],
    ['#ffb7c5', '#ff5a78'],
    ['#a3b8ff', '#4f46e5'],
    ['#ffd9b8', '#d97706']
  ] as const;
  const seed = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [start, end] = palettes[seed % palettes.length];
  const label = name.trim().slice(-2) || '同学';

  return {
    label,
    style: {
      background: `linear-gradient(135deg, ${start}, ${end})`
    }
  };
}

function readStoredReadMap(userId?: number) {
  if (!userId) {
    return {} as Record<number, string>;
  }

  try {
    const raw = localStorage.getItem(`${READ_STORAGE_PREFIX}${userId}`);
    if (!raw) {
      return {};
    }

    return JSON.parse(raw) as Record<number, string>;
  } catch {
    return {};
  }
}

function getSessionImage(session: ConversationSummary) {
  if (session.product?.imageUrl) {
    return session.product.imageUrl;
  }

  if (!session.product) {
    return getProductImage({
      title: session.participant.name,
      category: '宿舍好物',
      price: 0,
      condition: '同校私聊'
    });
  }

  return getProductImage({
    title: session.product.title,
    category: session.product.category,
    price: session.product.price,
    condition: session.product.condition,
    sellerName: session.participant.name
  });
}

const campusServiceStatusLabel = {
  OPEN: '待接单',
  MATCHED: '进行中',
  DONE: '已完成',
  CANCELED: '已取消'
} as const;

const campusServiceCategoryLabel = {
  ERRAND: '跑腿',
  AGENCY: '代办',
  GROUP_BUY: '拼单',
  HELP: '帮忙'
} as const;

function getSessionMetaLabel(session: ConversationSummary, unread: boolean) {
  if (unread) {
    return '未读';
  }

  if (session.campusServiceTaskId) {
    return session.selfRole === 'buyer' ? '我接单' : '我发布';
  }

  return session.selfRole === 'seller' ? '卖家会话' : '买家会话';
}

export function MessagesPage() {
  const currentUser = getDemoUser();
  const canTrade = hasTradingAccess(currentUser);
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const queryConversationId = Number(queryParams.get('conversationId'));
  const queryChannel = queryParams.get('channel');
  const routeState = location.state as { conversationId?: unknown; channel?: unknown } | null;
  const stateConversationId = typeof routeState?.conversationId === 'number'
    ? routeState.conversationId
    : null;
  const stateChannel = routeState?.channel === 'service' || routeState?.channel === 'trade'
    ? routeState.channel
    : null;
  const desiredConversationId = useRef<number | null>(
    stateConversationId
      ? stateConversationId
      : Number.isInteger(queryConversationId) && queryConversationId > 0
        ? queryConversationId
        : null
  );
  const desiredChannel = useRef<MessageChannel | null>(
    stateChannel
      ? stateChannel
      : queryChannel === 'service' || queryChannel === 'trade'
        ? queryChannel
        : null
  );
  const threadRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeIdRef = useRef<number | null>(null);
  const conversationsRef = useRef<ConversationSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [readMap, setReadMap] = useState<Record<number, string>>({});
  const [activeChannel, setActiveChannel] = useState<MessageChannel>('trade');
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? null,
    [conversations, activeId]
  );

  async function refreshConversations(preferredId?: number | null) {
    if (!currentUser?.id) {
      return [];
    }

    let resolvedUserId = currentUser.id;
    let list = await fetchConversations(resolvedUserId);
    const shouldHydrate = !list.length || list.length < 6 || list.filter((item) => item.product).length < 4;
    if (shouldHydrate) {
      const hydrated = await hydrateMessageDemos({
        userId: currentUser.id,
        studentId: currentUser.studentId,
        name: currentUser.name,
        email: currentUser.email
      });
      resolvedUserId = hydrated.user.id;
      if (hydrated.user.id !== currentUser.id) {
        saveDemoUser({
          id: hydrated.user.id,
          studentId: hydrated.user.studentId,
          name: hydrated.user.name,
          email: hydrated.user.email,
          role: hydrated.user.role,
          creditScore: hydrated.user.creditScore,
          verified: hydrated.user.verified
        });
      }
      list = await fetchConversations(resolvedUserId);
    }
    setConversations(list);
    const preferredConversation = preferredId ? list.find((item) => item.id === preferredId) : null;
    if (preferredConversation) {
      setActiveChannel(preferredConversation.campusServiceTaskId ? 'service' : 'trade');
    } else if (desiredChannel.current) {
      setActiveChannel(desiredChannel.current);
    } else if (!list.some((item) => !item.campusServiceTaskId) && list.some((item) => item.campusServiceTaskId)) {
      setActiveChannel('service');
    }
    setActiveId((previous) => {
      if (preferredId && list.some((item) => item.id === preferredId)) {
        return preferredId;
      }

      if (previous && list.some((item) => item.id === previous)) {
        return previous;
      }

      return list[0]?.id ?? null;
    });
    return list;
  }

  async function loadMessages(conversationId: number) {
    const list = await fetchConversationMessages(conversationId, currentUser?.id);
    setMessages(list);
  }

  function applyRealtimeMessage(event: NewMessageEvent) {
    const nextMessage = {
      ...event.message,
      createdAt: String(event.message.createdAt)
    };

    if (event.conversationId === activeIdRef.current) {
      setMessages((previous) => {
        if (previous.some((item) => item.id === nextMessage.id)) {
          return previous;
        }

        const optimisticIndex = previous.findIndex((item) =>
          item.id < 0 &&
          item.senderId === nextMessage.senderId &&
          item.content === nextMessage.content
        );

        if (optimisticIndex >= 0) {
          return previous.map((item, index) => (index === optimisticIndex ? nextMessage : item));
        }

        return [...previous, nextMessage];
      });
    }

    setConversations((previous) => {
      const next = previous.map((session) =>
        session.id === event.conversationId
          ? {
              ...session,
              preview: nextMessage.content,
              updatedAt: nextMessage.createdAt,
              latestMessageAt: nextMessage.createdAt,
              latestMessageSenderId: nextMessage.senderId
            }
          : session
      );

      next.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
      return next;
    });
  }

  function joinVisibleConversations(socket: Socket) {
    conversationsRef.current.forEach((conversation) => {
      socket.emit('message:join', { conversationId: conversation.id });
    });
  }

  function persistReadMap(next: Record<number, string>) {
    if (!currentUser?.id) {
      return;
    }

    localStorage.setItem(`${READ_STORAGE_PREFIX}${currentUser.id}`, JSON.stringify(next));
  }

  function markConversationRead(conversation: ConversationSummary) {
    setReadMap((previous) => {
      if (previous[conversation.id] === conversation.updatedAt) {
        return previous;
      }

      const next = {
        ...previous,
        [conversation.id]: conversation.updatedAt
      };
      persistReadMap(next);
      return next;
    });
  }

  function isUnreadConversation(session: ConversationSummary) {
    if (!currentUser?.id) {
      return false;
    }

    if (session.latestMessageSenderId === currentUser.id) {
      return false;
    }

    const lastReadAt = readMap[session.id];
    if (!lastReadAt) {
      return true;
    }

    return new Date(session.updatedAt).getTime() > new Date(lastReadAt).getTime();
  }

  function injectDraft(snippet: string) {
    setDraft((previous) => (previous.trim() ? `${previous}\n${snippet}` : snippet));
  }

  async function handleSend() {
    if (!activeId || !draft.trim()) {
      return;
    }

    if (!hasTradingAccess(currentUser)) {
      message.error(isGuestUser(currentUser) ? '游客不可发送消息' : '请先登录后再发送消息');
      return;
    }

    const activeUser = currentUser;
    if (!activeUser) {
      return;
    }

    const content = draft.trim();
    const optimisticTimestamp = new Date().toISOString();
    const optimisticMessage: ConversationMessage = {
      id: -Date.now(),
      senderId: activeUser.id,
      senderName: activeUser.name,
      content,
      type: 'TEXT',
      createdAt: optimisticTimestamp
    };

    setSending(true);
    setDraft('');
    setMessages((previous) => [...previous, optimisticMessage]);
    setConversations((previous) => {
      const next = previous.map((session) =>
        session.id === activeId
          ? {
              ...session,
              preview: content,
              updatedAt: optimisticTimestamp,
              latestMessageAt: optimisticTimestamp,
              latestMessageSenderId: activeUser.id
            }
          : session
      );

      next.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
      return next;
    });

    try {
      await sendConversationMessage(activeId, {
        senderId: activeUser.id,
        content
      });
      await Promise.all([loadMessages(activeId), refreshConversations(activeId)]);
    } catch (error) {
      setDraft(content);
      await Promise.all([loadMessages(activeId), refreshConversations(activeId)]);
      message.error(getApiErrorMessage(error, '消息发送失败，请稍后重试。'));
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  useEffect(() => {
    if (!currentUser?.id) {
      setReadMap({});
      return;
    }

    setReadMap(readStoredReadMap(currentUser.id));
  }, [currentUser?.id]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    if (!canTrade || !currentUser?.id) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;
    socket.on('connect', () => joinVisibleConversations(socket));
    socket.on('message:new', applyRealtimeMessage);

    return () => {
      socket.off('connect');
      socket.off('message:new', applyRealtimeMessage);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [canTrade, currentUser?.id]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !conversations.length) {
      return;
    }

    joinVisibleConversations(socket);
  }, [conversations]);

  useEffect(() => {
    if (!canTrade) {
      setConversations([]);
      setActiveId(null);
      setMessages([]);
      return;
    }

    refreshConversations(desiredConversationId.current).catch(() => {
      setConversations([]);
      setActiveId(null);
    });
    desiredConversationId.current = null;
    desiredChannel.current = null;
  }, [canTrade, currentUser?.id]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }

    loadMessages(activeId).catch(() => setMessages([]));
  }, [activeId, currentUser?.id]);

  useEffect(() => {
    if (activeConversation) {
      markConversationRead(activeConversation);
    }
  }, [activeConversation?.id, activeConversation?.updatedAt]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) {
      return;
    }

    thread.scrollTop = thread.scrollHeight;
  }, [messages, activeId]);

  useEffect(() => {
    if (!conversations.length) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const targetConversationId = Number(params.get('conversationId'));
    const targetChannel = params.get('channel');

    if (Number.isInteger(targetConversationId) && targetConversationId > 0) {
      const targetConversation = conversations.find((item) => item.id === targetConversationId);
      if (targetConversation) {
        setActiveChannel(targetConversation.campusServiceTaskId ? 'service' : 'trade');
        setActiveId(targetConversation.id);
      }
      return;
    }

    if (targetChannel === 'service' || targetChannel === 'trade') {
      setActiveChannel(targetChannel);
    }
  }, [conversations, location.search]);

  useEffect(() => {
    const visibleConversations = conversations.filter((item) =>
      activeChannel === 'service' ? item.campusServiceTaskId : !item.campusServiceTaskId
    );

    if (!visibleConversations.length) {
      if (activeId !== null) {
        setActiveId(null);
      }
      return;
    }

    if (!visibleConversations.some((item) => item.id === activeId)) {
      setActiveId(visibleConversations[0]?.id ?? null);
    }
  }, [conversations, activeId, activeChannel]);

  const isActiveCampusService = Boolean(activeConversation?.campusServiceTaskId);
  const activeServiceTask = activeConversation?.campusServiceTask ?? null;
  const tradeConversations = useMemo(
    () => conversations.filter((item) => !item.campusServiceTaskId),
    [conversations]
  );
  const serviceConversations = useMemo(
    () => conversations.filter((item) => item.campusServiceTaskId),
    [conversations]
  );
  const visibleConversations = activeChannel === 'service' ? serviceConversations : tradeConversations;

  const composerTools = isActiveCampusService ? [
    {
      key: 'emoji',
      label: '表情',
      icon: <SmileOutlined />,
      action: () => injectDraft('🙂')
    },
    {
      key: 'route',
      label: '路线',
      icon: <EnvironmentOutlined />,
      action: () => injectDraft(
        activeServiceTask
          ? `我确认一下路线：${activeServiceTask.locationFrom} -> ${activeServiceTask.locationTo}。`
          : '我确认一下取送地点和交接方式。'
      )
    },
    {
      key: 'time',
      label: '时间',
      icon: <FieldTimeOutlined />,
      action: () => injectDraft(activeServiceTask ? `我会尽量在${activeServiceTask.deadlineLabel}完成。` : '我会确认预计完成时间。')
    },
    {
      key: 'handoff',
      label: '交接',
      icon: <ShopOutlined />,
      action: () => injectDraft('到达后我在消息里发位置，方便交接。')
    }
  ] : [
    {
      key: 'emoji',
      label: '表情',
      icon: <SmileOutlined />,
      action: () => injectDraft('🙂')
    },
    {
      key: 'photo',
      label: '细节图',
      icon: <PictureOutlined />,
      action: () => injectDraft('方便的话我再补两张细节图。')
    },
    {
      key: 'bargain',
      label: '议价',
      icon: <ScissorOutlined />,
      action: () => injectDraft('价格还能小刀一点吗？')
    },
    {
      key: 'trade',
      label: '交易',
      icon: <ShopOutlined />,
      action: () => injectDraft('可以同校面交，支持当面验货。')
    },
    {
      key: 'location',
      label: '地点',
      icon: <EnvironmentOutlined />,
      action: () => injectDraft(
        activeConversation?.product?.meetupLocation
          ? `我们可以约在${activeConversation.product.meetupLocation}面交。`
          : '我们可以约在校内方便的位置面交。'
      )
    }
  ];

  return (
    <div className="page-grid messages-page trade-chat-page">
      {canTrade ? (
        <section className="trade-chat-shell">
          <aside className="trade-chat-sidebar">
            <div className="trade-chat-sidebar-head">
              <div className="trade-chat-sidebar-title">
                <strong>消息</strong>
              </div>
              <div className="trade-chat-channel-tabs" role="tablist" aria-label="消息类型">
                <button
                  type="button"
                  className={activeChannel === 'trade' ? 'trade-chat-channel-tab active' : 'trade-chat-channel-tab'}
                  onClick={() => setActiveChannel('trade')}
                  role="tab"
                  aria-selected={activeChannel === 'trade'}
                >
                  <ShopOutlined />
                  <span>交易</span>
                  <em>{tradeConversations.length}</em>
                </button>
                <button
                  type="button"
                  className={activeChannel === 'service' ? 'trade-chat-channel-tab active' : 'trade-chat-channel-tab'}
                  onClick={() => setActiveChannel('service')}
                  role="tab"
                  aria-selected={activeChannel === 'service'}
                >
                  <EnvironmentOutlined />
                  <span>跑腿</span>
                  <em>{serviceConversations.length}</em>
                </button>
              </div>
            </div>

            <div className="trade-chat-session-list">
              {visibleConversations.length ? visibleConversations.map((session) => {
                const avatar = getAvatarMeta(session.participant.name);
                const unread = isUnreadConversation(session);
                const isCampusServiceSession = Boolean(session.campusServiceTaskId);
                const metaLabel = getSessionMetaLabel(session, unread);

                return (
                  <button
                    key={session.id}
                    type="button"
                    className={`${session.id === activeId ? 'trade-chat-session active' : 'trade-chat-session'}${isCampusServiceSession ? ' service-session' : ''}`}
                    onClick={() => setActiveId(session.id)}
                  >
                    <div className="trade-chat-avatar" style={avatar.style}>
                      {avatar.label}
                    </div>
                    <div className="trade-chat-session-copy">
                      <div className="trade-chat-session-top">
                        <strong>{session.participant.name}</strong>
                        <span>{formatSessionTime(session.updatedAt)}</span>
                      </div>
                      <div className="trade-chat-session-preview">{session.preview}</div>
                      <div className="trade-chat-session-meta">
                        <span>{session.campusServiceTask?.title ?? session.campusServiceTaskTitle ?? session.product?.title ?? '同校私聊'}</span>
                        {unread ? <em>{metaLabel}</em> : <span>{metaLabel}</span>}
                      </div>
                    </div>
                    {isCampusServiceSession ? (
                      <div className="trade-chat-session-service-mark">
                        <EnvironmentOutlined />
                        <span>{session.campusServiceTask ? campusServiceCategoryLabel[session.campusServiceTask.category] : '服务'}</span>
                      </div>
                    ) : (
                      <img
                        src={getSessionImage(session)}
                        alt={session.product?.title ?? session.participant.name}
                        className="trade-chat-session-thumb"
                      />
                    )}
                  </button>
                );
              }) : (
                <div className="trade-chat-empty-shell">
                  <Empty description={activeChannel === 'service' ? '暂无跑腿会话' : '暂无交易会话'} />
                </div>
              )}
            </div>
          </aside>

          <section className={isActiveCampusService ? 'trade-chat-main service-mode' : 'trade-chat-main'}>
            {activeConversation ? (
              <>
                <div className="trade-chat-main-head">
                  <div className="trade-chat-main-user">
                    <div className="trade-chat-main-title-row">
                      <strong>{activeConversation.participant.name}</strong>
                      <span className="trade-chat-role-tag">
                        {activeConversation.campusServiceTaskId
                          ? activeConversation.selfRole === 'buyer' ? '接单方' : '发布方'
                          : activeConversation.participant.isSeller ? '卖家' : '同校用户'}
                      </span>
                    </div>
                    <span>
                      {activeConversation.participant.college ?? '同校认证用户'}
                      {activeConversation.campusServiceTaskId
                        ? ` · ${activeConversation.campusServiceTask ? campusServiceStatusLabel[activeConversation.campusServiceTask.status] : '服务协作'}`
                        : activeConversation.product?.meetupLocation ? ` · 常约 ${activeConversation.product.meetupLocation}` : ''}
                    </span>
                  </div>
                  <div className="trade-chat-head-actions">
                    {activeConversation.product ? (
                      <button
                        type="button"
                        className="trade-chat-head-pill"
                        onClick={() => navigate(`/products/${activeConversation.product?.id}`)}
                      >
                        <ShopOutlined />
                        商品详情
                      </button>
                    ) : null}
                    <button type="button" className="trade-chat-icon-button" aria-label="更多操作">
                      <MoreOutlined />
                    </button>
                  </div>
                </div>

                <div className="trade-chat-context-slot">
                  {activeConversation.product ? (
                    <div className="trade-chat-product-card">
                      <img
                        src={getSessionImage(activeConversation)}
                        alt={activeConversation.product.title}
                        className="trade-chat-product-image"
                      />
                      <div className="trade-chat-product-copy">
                        <strong>{activeConversation.product.title}</strong>
                        <b>活动价 ¥{activeConversation.product.price.toFixed(2)}</b>
                        <span>
                          {activeConversation.product.condition}
                          {activeConversation.product.meetupLocation ? ` · ${activeConversation.product.meetupLocation}` : ' · 同校面交'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="trade-chat-buy-button"
                        onClick={() => navigate(`/products/${activeConversation.product?.id}`)}
                      >
                        立即购买
                      </button>
                    </div>
                  ) : activeConversation.campusServiceTaskId ? (
                    <div className="trade-chat-service-card">
                      <div className="trade-chat-service-icon">
                        <EnvironmentOutlined />
                      </div>
                      <div className="trade-chat-product-copy">
                        <strong>{activeConversation.campusServiceTask?.title ?? activeConversation.campusServiceTaskTitle ?? '校园服务委托'}</strong>
                        <b>{activeConversation.campusServiceTask ? `酬谢 ¥${activeConversation.campusServiceTask.reward}` : '服务协作'}</b>
                        <span>
                          {activeConversation.campusServiceTask
                            ? `${activeConversation.campusServiceTask.locationFrom} -> ${activeConversation.campusServiceTask.locationTo}`
                            : '在消息里确认取送地点、时间和交接方式'}
                        </span>
                      </div>
                      {activeConversation.campusServiceTask ? (
                        <div className="trade-chat-service-tags">
                          <span>{campusServiceCategoryLabel[activeConversation.campusServiceTask.category]}</span>
                          <span>{activeConversation.campusServiceTask.deadlineLabel}</span>
                          <span>{activeConversation.campusServiceTask.estimatedMinutes} 分钟</span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="trade-chat-context-placeholder" aria-hidden="true" />
                  )}
                </div>

                <div className="trade-chat-thread" ref={threadRef}>
                  {messages.length ? messages.map((entry, index) => {
                    const isSelf = entry.senderId === currentUser?.id;
                    const avatar = getAvatarMeta(isSelf ? currentUser?.name ?? entry.senderName : entry.senderName);
                    const showDivider = index === 0 || !isSameDay(messages[index - 1].createdAt, entry.createdAt);
                    const isLatestSelfMessage = isSelf && index === messages.length - 1 && activeConversation.latestMessageSenderId === currentUser?.id;

                    return (
                      <div key={entry.id} className="trade-chat-message-block">
                        {showDivider ? (
                          <div className="trade-chat-divider">
                            <span>{formatDividerLabel(entry.createdAt)}</span>
                          </div>
                        ) : null}

                        <div className={isSelf ? 'trade-chat-row self' : 'trade-chat-row other'}>
                          {!isSelf ? (
                            <div className="trade-chat-avatar small" style={avatar.style}>
                              {avatar.label}
                            </div>
                          ) : null}
                          <div className="trade-chat-bubble-wrap">
                            <span className="trade-chat-speaker">{isSelf ? currentUser?.name ?? '我' : entry.senderName}</span>
                            <div className={isSelf ? 'trade-chat-bubble self' : 'trade-chat-bubble other'}>
                              {entry.content}
                            </div>
                            <div className={isSelf ? 'trade-chat-bubble-meta self' : 'trade-chat-bubble-meta'}>
                              <span>{formatBubbleTime(entry.createdAt)}</span>
                              {isLatestSelfMessage ? <em>未读</em> : null}
                            </div>
                          </div>
                          {isSelf ? (
                            <div className="trade-chat-avatar small" style={avatar.style}>
                              {avatar.label}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="trade-chat-empty-shell thread">
                      <Empty description="当前会话暂无消息，发一句试试" />
                    </div>
                  )}
                </div>

                <div className="trade-chat-compose">
                  <div className="trade-chat-tools">
                    {composerTools.map((tool) => (
                      <button
                        key={tool.key}
                        type="button"
                        className="trade-chat-tool"
                        onClick={tool.action}
                        disabled={!activeConversation}
                        title={tool.label}
                        aria-label={tool.label}
                      >
                        {tool.icon}
                      </button>
                    ))}
                  </div>

                  <div className="trade-chat-compose-row">
                    <Input.TextArea
                      rows={3}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      placeholder="请输入消息，按 Enter 发送，Shift + Enter 换行"
                      disabled={!activeConversation}
                    />
                    <button
                      type="button"
                      className="trade-chat-send-button"
                      onClick={() => void handleSend()}
                      disabled={!draft.trim() || sending}
                    >
                      <SendOutlined />
                      发送
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="trade-chat-empty-shell main">
                <Empty description="从左侧选择一个会话开始沟通" />
              </div>
            )}
          </section>
        </section>
      ) : (
        <div className="trade-chat-guest-card">
          <strong>{isGuestUser(currentUser) ? '游客不可查看私聊' : '登录后查看私聊消息'}</strong>
          <span>
            {isGuestUser(currentUser)
              ? '如需联系卖家、继续砍价或约面交，请先登录普通用户账号。'
              : '登录后可查看最近联系、发送消息、进入商品详情并继续交易。'}
          </span>
        </div>
      )}
    </div>
  );
}
