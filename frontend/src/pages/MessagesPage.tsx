import {
  EnvironmentOutlined,
  FileImageOutlined,
  LoadingOutlined,
  SendOutlined,
  ShopOutlined,
  SmileOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';
import { Empty, Input, message } from 'antd';
import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { CAMPUS_SERVICE_CATEGORY_LABEL } from '../constants/campusServiceCategories';
import { UserNameWithBadge } from '../components/user/UserNameWithBadge';
import { type AvatarFrameKey, UserAvatar } from '../components/user/UserAvatar';
import { useAuthState } from '../services/auth-state';
import Session from 'supertokens-auth-react/recipe/session';
import {
  ConversationMessage,
  ConversationSummary,
  createConversation,
  fetchConversationMessages,
  fetchConversations,
  getApiErrorMessage,
  sendConversationMessage,
  uploadMessageAttachment
} from '../services/api';
import { normalizeProductCategoryName } from '../constants/productCategories';
import { hasTradingAccess, isGuestUser } from '../services/session';
import { DEMO_PRODUCT_IMAGE, getProductImage } from '../utils/productCover';

const READ_STORAGE_PREFIX = 'swapcampus-message-read-map:';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
type NewMessageEvent = {
  conversationId: number;
  message: ConversationMessage;
};

type MessageChannel = 'trade' | 'service';

type DraftConversation = {
  productId: number;
  product: { id: number; title: string; price: number; imageUrl: string | null };
  participant: { id: number | null; displayName: string; college: string | null; trustedBadgeUnlocked?: boolean };
};

function parseDraftConversation(value: unknown): DraftConversation | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, any>;
  if (typeof candidate.productId !== 'number' || !candidate.product) {
    return null;
  }

  return {
    productId: candidate.productId,
    product: {
      id: Number(candidate.product.id ?? candidate.productId),
      title: String(candidate.product.title ?? ''),
      price: Number(candidate.product.price ?? 0),
      imageUrl: typeof candidate.product.imageUrl === 'string' ? candidate.product.imageUrl : null
    },
    participant: {
      id: typeof candidate.participant?.id === 'number' ? candidate.participant.id : null,
      displayName: String(candidate.participant?.displayName ?? '卖家'),
      college: candidate.participant?.college ?? null,
      trustedBadgeUnlocked: Boolean(candidate.participant?.trustedBadgeUnlocked)
    }
  };
}

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

function getPreviewText(entry: Pick<ConversationMessage, 'type' | 'content' | 'previewText'>) {
  if (entry.previewText?.trim()) {
    return entry.previewText;
  }

  if (entry.type === 'IMAGE') {
    return '[图片]';
  }

  if (entry.type === 'VIDEO') {
    return '[视频]';
  }

  return entry.content;
}

const EMOJI_CHOICES = [
  '🙂', '😄', '😅', '😉', '😍', '🤝',
  '👍', '👌', '🙏', '💪', '🎉', '✅',
  '❤️', '🔥', '💰', '📦', '📍', '⏰'
] as const;

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
  if (!session.product) {
    return DEMO_PRODUCT_IMAGE;
  }

  return getProductImage({
    title: session.product.title,
    category: normalizeProductCategoryName(session.product.category),
    price: session.product.price,
    condition: session.product.condition,
    imageUrl: session.product.imageUrl ?? undefined,
    sellerName: session.participant.displayName
  });
}

const campusServiceStatusLabel = {
  OPEN: '可参与',
  BUSY: '名额已满',
  PAUSED: '已暂停',
  ENDED: '已结束',
  MATCHED: '进行中',
  DONE: '已完成',
  CANCELED: '已取消'
} as const;

function getCampusConversation(session: ConversationSummary) {
  if (session.campusServiceDisplay) {
    return session.campusServiceDisplay;
  }

  if (!session.campusServiceListing) {
    return null;
  }

  return {
    title: session.campusServiceListing.title,
    category: session.campusServiceListing.category,
    categoryLabel: CAMPUS_SERVICE_CATEGORY_LABEL[session.campusServiceListing.category],
    intent: session.campusServiceListing.intent,
    intentLabel: session.campusServiceListing.intentLabel,
    reward: session.campusServiceListing.reward,
    routeLabel: `${session.campusServiceListing.locationFrom} -> ${session.campusServiceListing.locationTo}`,
    locationFrom: session.campusServiceListing.locationFrom,
    locationTo: session.campusServiceListing.locationTo,
    deadlineLabel: session.campusServiceListing.deadlineLabel,
    estimatedMinutes: session.campusServiceListing.estimatedMinutes,
    status: session.campusServiceListing.status,
    statusLabel: campusServiceStatusLabel[session.campusServiceListing.status]
  };
}

function isCampusServiceConversation(session: ConversationSummary) {
  return Boolean(session.campusServiceOrderId ?? session.campusServiceListing ?? session.campusServiceDisplay);
}

export function MessagesPage() {
  const { currentUser } = useAuthState();
  const canTrade = hasTradingAccess(currentUser);
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const queryConversationId = Number(queryParams.get('conversationId'));
  const queryChannel = queryParams.get('channel');
  const routeState = location.state as { conversationId?: unknown; channel?: unknown; draftConversation?: unknown } | null;
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
  const desiredDraft = useRef<DraftConversation | null>(parseDraftConversation(routeState?.draftConversation));
  const threadRef = useRef<HTMLDivElement | null>(null);
  const emojiRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeIdRef = useRef<number | null>(null);
  const conversationsRef = useRef<ConversationSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [readMap, setReadMap] = useState<Record<number, string>>({});
  const [activeChannel, setActiveChannel] = useState<MessageChannel>('trade');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<DraftConversation | null>(() =>
    parseDraftConversation(routeState?.draftConversation)
  );
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? null,
    [conversations, activeId]
  );

  const tradeProductAction = activeConversation?.product
    ? activeConversation.product.orderStatus === 'COMPLETED'
      ? { label: '商品已成交', href: `/orders/${activeConversation.product.orderId ?? activeConversation.product.id}` }
      : activeConversation.product.isBuyer
        ? { label: '确定收货', href: `/orders/${activeConversation.product.orderId ?? activeConversation.product.id}` }
        : activeConversation.product.isSeller
          ? { label: '商品已售出', href: `/orders/${activeConversation.product.orderId ?? activeConversation.product.id}` }
          : { label: '立即下单', href: `/orders/checkout?type=product&productId=${activeConversation.product.id}` }
    : null;

  async function refreshConversations(preferredId?: number | null, options?: { keepPending?: boolean }) {
    if (!currentUser?.id) {
      return [];
    }

    let list = await fetchConversations();
    setConversations(list);
    const preferredConversation = preferredId ? list.find((item) => item.id === preferredId) : null;
    if (preferredConversation) {
      setActiveChannel(isCampusServiceConversation(preferredConversation) ? 'service' : 'trade');
    } else if (desiredChannel.current) {
      setActiveChannel(desiredChannel.current);
    } else if (!list.some((item) => !isCampusServiceConversation(item)) && list.some((item) => isCampusServiceConversation(item))) {
      setActiveChannel('service');
    }
    setActiveId((previous) => {
      if (preferredId && list.some((item) => item.id === preferredId)) {
        return preferredId;
      }

      // When entering a pending (not-yet-created) conversation, do not auto-select an
      // existing thread — keep the composer focused on the new draft.
      if (options?.keepPending) {
        return null;
      }

      if (previous && list.some((item) => item.id === previous)) {
        return previous;
      }

      return list[0]?.id ?? null;
    });
    return list;
  }

  async function loadMessages(conversationId: number) {
    const list = await fetchConversationMessages(conversationId);
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
          item.content === nextMessage.content &&
          item.type === nextMessage.type
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
              preview: getPreviewText(nextMessage),
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

  function insertEmoji(emoji: string) {
    setDraft((previous) => previous + emoji);
  }

  async function handleSend() {
    if (!draft.trim() || (!activeId && !pendingDraft)) {
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

    // Pending draft: the conversation is created with the user's own first message,
    // so nothing is auto-sent when they merely open the chat from a product page.
    if (!activeId && pendingDraft) {
      setSending(true);
      try {
        const created = await createConversation({ productId: pendingDraft.productId, initialMessage: content });
        // A brand-new conversation stores `content` as its first message. A reused one
        // (e.g. an older thread not in the loaded list) ignores initialMessage, so send it.
        if (created.reused) {
          await sendConversationMessage(created.id, { content });
        }
        setDraft('');
        setPendingDraft(null);
        setEmojiOpen(false);
        await refreshConversations(created.id);
      } catch (error) {
        message.error(getApiErrorMessage(error, '消息发送失败，请稍后重试。'));
      } finally {
        setSending(false);
      }
      return;
    }

    if (!activeId) {
      return;
    }

    const optimisticTimestamp = new Date().toISOString();
    const optimisticMessage: ConversationMessage = {
      id: -Date.now(),
      senderId: activeUser.id,
      senderName: activeUser.displayName,
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

  async function sendAttachmentMessage(kind: 'IMAGE' | 'VIDEO', file: File) {
    if (!hasTradingAccess(currentUser)) {
      message.error(isGuestUser(currentUser) ? '游客不可发送消息' : '请先登录后再发送消息');
      return;
    }

    if ((!activeId && !pendingDraft) || !currentUser) {
      return;
    }

    setUploadingAttachment(true);
    setEmojiOpen(false);

    try {
      const uploaded = await uploadMessageAttachment(file);
      let targetConversationId = activeId;

      if (!targetConversationId && pendingDraft) {
        const created = await createConversation({ productId: pendingDraft.productId });
        targetConversationId = created.id;
        setPendingDraft(null);
        await refreshConversations(created.id);
      }

      if (!targetConversationId) {
        throw new Error('会话不存在');
      }

      await sendConversationMessage(targetConversationId, {
        type: kind,
        attachment: uploaded
      });
      await Promise.all([loadMessages(targetConversationId), refreshConversations(targetConversationId)]);
    } catch (error) {
      message.error(getApiErrorMessage(error, kind === 'IMAGE' ? '图片发送失败，请稍后重试。' : '视频发送失败，请稍后重试。'));
    } finally {
      setUploadingAttachment(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      if (videoInputRef.current) {
        videoInputRef.current.value = '';
      }
    }
  }

  function handleAttachmentFileChange(kind: 'IMAGE' | 'VIDEO', event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    void sendAttachmentMessage(kind, file);
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

    let active = true;

    async function connectSocket() {
      const accessToken = await Session.getAccessToken();
      if (!active || !accessToken) {
        return;
      }

      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        auth: {
          authorization: `Bearer ${accessToken}`
        }
      });
      socketRef.current = socket;
      socket.on('connect', () => joinVisibleConversations(socket));
      socket.on('message:new', applyRealtimeMessage);
    }

    void connectSocket();

    return () => {
      active = false;
      const socket = socketRef.current;
      socket?.off('connect');
      socket?.off('message:new', applyRealtimeMessage);
      socket?.disconnect();
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
      setPendingDraft(null);
      return;
    }

    const draft = desiredDraft.current;

    refreshConversations(desiredConversationId.current, { keepPending: Boolean(draft) })
      .then((list) => {
        if (!draft) {
          return;
        }

        const existing = list.find(
          (item) => !isCampusServiceConversation(item) && item.productId === draft.productId
        );
        setActiveChannel('trade');
        if (existing) {
          setActiveId(existing.id);
          setPendingDraft(null);
        } else {
          setPendingDraft(draft);
        }
      })
      .catch(() => {
        setConversations([]);
        setActiveId(null);
      });
    desiredConversationId.current = null;
    desiredChannel.current = null;
    desiredDraft.current = null;
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
    setEmojiOpen(false);
  }, [activeId]);

  useEffect(() => {
    if (!emojiOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
        setEmojiOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [emojiOpen]);

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
        setActiveChannel(isCampusServiceConversation(targetConversation) ? 'service' : 'trade');
        setActiveId(targetConversation.id);
      }
      return;
    }

    if (targetChannel === 'service' || targetChannel === 'trade') {
      setActiveChannel(targetChannel);
    }
  }, [conversations, location.search]);

  useEffect(() => {
    // A pending (not-yet-created) draft owns the main panel; don't auto-select a thread.
    if (pendingDraft) {
      return;
    }

    const visibleConversations = conversations.filter((item) =>
      activeChannel === 'service' ? isCampusServiceConversation(item) : !isCampusServiceConversation(item)
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
  }, [conversations, activeId, activeChannel, pendingDraft]);

  const isActiveCampusService = Boolean(activeConversation && isCampusServiceConversation(activeConversation));
  const activeServiceTask = activeConversation ? getCampusConversation(activeConversation) : null;
  const composerEnabled = Boolean(activeConversation || pendingDraft);
  const toolsDisabled = !composerEnabled || sending || uploadingAttachment;
  const tradeConversations = useMemo(
    () => conversations.filter((item) => !isCampusServiceConversation(item)),
    [conversations]
  );
  const serviceConversations = useMemo(
    () => conversations.filter((item) => isCampusServiceConversation(item)),
    [conversations]
  );
  const visibleConversations = activeChannel === 'service' ? serviceConversations : tradeConversations;
  // Campus-service headers keep a real status line; trade headers show name + role only.
  const headerSubtitleParts = activeConversation && isActiveCampusService
    ? [
        activeConversation.participant.college,
        activeServiceTask?.status ? campusServiceStatusLabel[activeServiceTask.status] : null
      ].filter((part): part is string => Boolean(part))
    : [];

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
                  onClick={() => {
                    setActiveChannel('trade');
                    setPendingDraft(null);
                  }}
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
                  onClick={() => {
                    setActiveChannel('service');
                    setPendingDraft(null);
                  }}
                  role="tab"
                  aria-selected={activeChannel === 'service'}
                >
                  <EnvironmentOutlined />
                  <span>服务</span>
                  <em>{serviceConversations.length}</em>
                </button>
              </div>
            </div>

            <div className="trade-chat-session-list">
              {visibleConversations.length ? visibleConversations.map((session) => {
                const isCampusServiceSession = isCampusServiceConversation(session);
                const campusConversation = getCampusConversation(session);

                return (
                  <button
                    key={session.id}
                    type="button"
                    className={`${session.id === activeId ? 'trade-chat-session active' : 'trade-chat-session'}${isCampusServiceSession ? ' service-session' : ''}`}
                    onClick={() => {
                      setActiveId(session.id);
                      setPendingDraft(null);
                    }}
                  >
                    <UserAvatar
                      src={session.participant.avatarUrl}
                      fallbackLabel={session.participant.displayName}
                      alt={session.participant.displayName}
                      className="trade-chat-avatar"
                      frame={(session.participant.avatarFrame as AvatarFrameKey | null) ?? undefined}
                    />
                    <div className="trade-chat-session-copy">
                      <div className="trade-chat-session-top">
                        <UserNameWithBadge
                          as="strong"
                          name={session.participant.displayName}
                          trustedBadgeUnlocked={session.participant.trustedBadgeUnlocked}
                        />
                        <span>{formatSessionTime(session.updatedAt)}</span>
                      </div>
                      <div className="trade-chat-session-preview">{session.preview}</div>
                    </div>
                    {isCampusServiceSession ? (
                      <div className="trade-chat-session-service-mark">
                        <EnvironmentOutlined />
                        <span>{campusConversation?.category ? CAMPUS_SERVICE_CATEGORY_LABEL[campusConversation.category] : '服务'}</span>
                      </div>
                    ) : session.product ? (
                      <img
                        src={getSessionImage(session)}
                        alt={session.product.title}
                        className="trade-chat-session-thumb"
                      />
                    ) : null}
                  </button>
                );
              }) : (
                <div className="trade-chat-empty-shell">
                  <Empty description={activeChannel === 'service' ? '暂无服务会话' : '暂无交易会话'} />
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
                      <UserNameWithBadge
                        as="strong"
                        name={activeConversation.participant.displayName}
                        trustedBadgeUnlocked={activeConversation.participant.trustedBadgeUnlocked}
                      />
                    </div>
                    {headerSubtitleParts.length ? <span>{headerSubtitleParts.join(' · ')}</span> : null}
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
                        <b>¥{activeConversation.product.price.toFixed(2)}</b>
                        {activeConversation.product.meetupLocation ? (
                          <span>{activeConversation.product.meetupLocation}</span>
                        ) : null}
                      </div>
                      <div className="trade-chat-product-actions">
                        <button
                          type="button"
                          className="trade-chat-buy-button secondary"
                          onClick={() => navigate(`/orders/${activeConversation.product?.orderId ?? activeConversation.product?.id}`)}
                        >
                          订单详情
                        </button>
                        <button
                          type="button"
                          className="trade-chat-buy-button"
                          disabled={!tradeProductAction || tradeProductAction.label === '商品已成交'}
                          onClick={() =>
                            tradeProductAction && tradeProductAction.label !== '商品已成交'
                              ? navigate(tradeProductAction.href)
                              : undefined
                          }
                        >
                          {tradeProductAction?.label ?? '立即下单'}
                        </button>
                      </div>
                    </div>
                  ) : isCampusServiceConversation(activeConversation) && activeServiceTask ? (
                    <div className="trade-chat-service-card">
                      <div className="trade-chat-service-icon">
                        <EnvironmentOutlined />
                      </div>
                      <div className="trade-chat-product-copy">
                        <strong>{activeServiceTask.title}</strong>
                        <b>
                          {activeServiceTask.intentLabel
                            ? `${activeServiceTask.intentLabel} · ¥${activeServiceTask.reward}`
                            : `¥${activeServiceTask.reward}`}
                        </b>
                        <span>{`${activeServiceTask.locationFrom} -> ${activeServiceTask.locationTo}`}</span>
                      </div>
                      <div className="trade-chat-service-tags">
                        <span>{activeServiceTask.category ? CAMPUS_SERVICE_CATEGORY_LABEL[activeServiceTask.category] : '服务'}</span>
                        <span>{activeServiceTask.deadlineLabel}</span>
                        <span>{activeServiceTask.estimatedMinutes} 分钟</span>
                      </div>
                    </div>
                  ) : (
                    <div className="trade-chat-context-placeholder" aria-hidden="true" />
                  )}
                </div>

                <div className="trade-chat-thread" ref={threadRef}>
                  {messages.length ? messages.map((entry, index) => {
                    const isSelf = entry.senderId === currentUser?.id;
                    const avatarSrc = isSelf ? currentUser?.avatarUrl : entry.senderAvatarUrl;
                    const avatarFrame = isSelf ? currentUser?.avatarFrame : entry.senderAvatarFrame;
                    const avatarName = isSelf ? currentUser?.displayName ?? '我' : entry.senderName;
                    const showDivider = index === 0 || !isSameDay(messages[index - 1].createdAt, entry.createdAt);

                    return (
                      <div key={entry.id} className="trade-chat-message-block">
                        {showDivider ? (
                          <div className="trade-chat-divider">
                            <span>{formatDividerLabel(entry.createdAt)}</span>
                          </div>
                        ) : null}

                        <div className={isSelf ? 'trade-chat-row self' : 'trade-chat-row other'}>
                          {!isSelf ? (
                            <UserAvatar
                              src={avatarSrc}
                              fallbackLabel={avatarName}
                              alt={avatarName}
                              className="trade-chat-avatar small"
                              frame={(avatarFrame as AvatarFrameKey | null) ?? undefined}
                            />
                          ) : null}
                          <div className="trade-chat-bubble-wrap">
                            <div className={isSelf ? 'trade-chat-bubble self' : 'trade-chat-bubble other'}>
                              {entry.type === 'ORDER_EVENT' && entry.orderEvent ? (
                                <div className="trade-chat-order-event-card">
                                  <div className="trade-chat-order-event-top">
                                    <strong>{entry.orderEvent.title}</strong>
                                    {entry.orderEvent.badge ? <span>{entry.orderEvent.badge}</span> : null}
                                  </div>
                                  <p>{entry.orderEvent.summary}</p>
                                  <div className="trade-chat-order-event-meta">
                                    <em>订单编号：{entry.orderEvent.orderCode}</em>
                                    {(entry.orderEvent.meta ?? []).map((metaItem) => (
                                      <em key={`${metaItem.label}:${metaItem.value}`}>{metaItem.label}：{metaItem.value}</em>
                                    ))}
                                  </div>
                                  <div className="trade-chat-order-event-actions">
                                    <button
                                      type="button"
                                      className="trade-chat-buy-button secondary"
                                      onClick={() => navigate(entry.orderEvent?.actionTarget ?? `/orders/${entry.orderEvent?.orderId}`)}
                                    >
                                      {entry.orderEvent.actionLabel ?? '查看订单'}
                                    </button>
                                  </div>
                                </div>
                              ) : entry.type === 'IMAGE' && entry.attachment ? (
                                <img
                                  src={entry.attachment.url}
                                  alt={entry.attachment.originalName ?? '聊天图片'}
                                  className="trade-chat-bubble-media trade-chat-bubble-image"
                                />
                              ) : entry.type === 'VIDEO' && entry.attachment ? (
                                <video
                                  src={entry.attachment.url}
                                  className="trade-chat-bubble-media trade-chat-bubble-video"
                                  controls
                                  preload="metadata"
                                />
                              ) : (
                                entry.content
                              )}
                            </div>
                            <div className={isSelf ? 'trade-chat-bubble-meta self' : 'trade-chat-bubble-meta'}>
                              <span>{formatBubbleTime(entry.createdAt)}</span>
                            </div>
                          </div>
                          {isSelf ? (
                            <UserAvatar
                              src={avatarSrc}
                              fallbackLabel={avatarName}
                              alt={avatarName}
                              className="trade-chat-avatar small"
                              frame={(avatarFrame as AvatarFrameKey | null) ?? undefined}
                            />
                          ) : null}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="trade-chat-empty-shell thread">
                      <Empty description="暂无消息" />
                    </div>
                  )}
                </div>

              </>
            ) : pendingDraft ? (
              <>
                <div className="trade-chat-main-head">
                  <div className="trade-chat-main-user">
                    <div className="trade-chat-main-title-row">
                      <UserNameWithBadge
                        as="strong"
                        name={pendingDraft.participant.displayName}
                        trustedBadgeUnlocked={pendingDraft.participant.trustedBadgeUnlocked}
                      />
                    </div>
                  </div>
                </div>

                <div className="trade-chat-context-slot">
                  <div className="trade-chat-product-card">
                    <img
                      src={getProductImage({
                        title: pendingDraft.product.title,
                        category: '其他',
                        price: pendingDraft.product.price,
                        imageUrl: pendingDraft.product.imageUrl ?? undefined
                      })}
                      alt={pendingDraft.product.title}
                      className="trade-chat-product-image"
                    />
                    <div className="trade-chat-product-copy">
                      <strong>{pendingDraft.product.title}</strong>
                      <b>¥{pendingDraft.product.price.toFixed(2)}</b>
                    </div>
                    <div className="trade-chat-product-actions">
                      <button
                        type="button"
                        className="trade-chat-buy-button secondary"
                        onClick={() => navigate(`/products/${pendingDraft.product.id}`)}
                      >
                        商品详情
                      </button>
                        <button
                          type="button"
                          className="trade-chat-buy-button"
                          onClick={() => navigate(`/orders/checkout?type=product&productId=${pendingDraft.product.id}`)}
                        >
                          立即下单
                        </button>
                      </div>
                    </div>
                </div>

                <div className="trade-chat-thread">
                  <div className="trade-chat-empty-shell thread">
                    <Empty description="暂无消息" />
                  </div>
                </div>
              </>
            ) : null}

            {activeConversation || pendingDraft ? (
                <div className="trade-chat-compose">
                  <div className="trade-chat-tools">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) => handleAttachmentFileChange('IMAGE', event)}
                    />
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/*"
                      hidden
                      onChange={(event) => handleAttachmentFileChange('VIDEO', event)}
                    />
                    <button
                      type="button"
                      className="trade-chat-tool"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={toolsDisabled}
                      title="发送图片"
                      aria-label="发送图片"
                    >
                      {uploadingAttachment ? <LoadingOutlined /> : <FileImageOutlined />}
                    </button>
                    <button
                      type="button"
                      className="trade-chat-tool"
                      onClick={() => videoInputRef.current?.click()}
                      disabled={toolsDisabled}
                      title="发送视频"
                      aria-label="发送视频"
                    >
                      {uploadingAttachment ? <LoadingOutlined /> : <VideoCameraOutlined />}
                    </button>
                    <div className="trade-chat-emoji" ref={emojiRef}>
                      <button
                        type="button"
                        className={emojiOpen ? 'trade-chat-tool active' : 'trade-chat-tool'}
                        onClick={() => setEmojiOpen((open) => !open)}
                        disabled={toolsDisabled}
                        title="表情"
                        aria-label="表情"
                        aria-haspopup="menu"
                      aria-expanded={emojiOpen}
                    >
                      <SmileOutlined />
                    </button>
                    {emojiOpen ? (
                      <div className="trade-chat-emoji-panel" role="menu" aria-label="表情">
                        {EMOJI_CHOICES.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="trade-chat-emoji-option"
                            onClick={() => insertEmoji(emoji)}
                            aria-label={`插入表情 ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="trade-chat-compose-row">
                  <Input.TextArea
                    rows={3}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="输入消息…"
                    disabled={!composerEnabled || uploadingAttachment}
                  />
                  <button
                    type="button"
                    className="trade-chat-send-button"
                    onClick={() => void handleSend()}
                    disabled={!draft.trim() || sending || uploadingAttachment}
                  >
                    <SendOutlined />
                    {uploadingAttachment ? '上传中' : '发送'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="trade-chat-empty-shell main">
                <Empty description="暂无会话" />
              </div>
            )}
          </section>
        </section>
      ) : (
        <div className="trade-chat-guest-card">
          <strong>{isGuestUser(currentUser) ? '游客不可查看私聊' : '请先登录'}</strong>
        </div>
      )}
    </div>
  );
}
