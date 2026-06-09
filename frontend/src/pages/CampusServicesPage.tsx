import {
  Alert,
  Button,
  Input,
  Modal,
  Pagination,
  Skeleton
} from 'antd';
import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { PeelBack, PeelBottom, PeelTop, PeelWrapper, usePeel } from 'react-peel';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/feedback';
import { ProductGrid, ProductSummaryCard, ResultFilterBar } from '../components/product';
import { useAuthState } from '../services/auth-state';
import {
  acceptCampusServiceTask,
  cancelCampusServiceTask,
  type CampusServiceCategory,
  type CampusServiceListItem,
  completeCampusServiceTask,
  fetchCampusServiceTasks,
  getApiErrorMessage
} from '../services/api';
import { getListingStatusPresentation } from '../utils/listingStatus';

const moduleConfig: Array<{
  key: CampusServiceCategory;
  title: string;
}> = [
  { key: 'ERRAND', title: '校园跑腿' },
  { key: 'AGENCY', title: '代办代取' },
  { key: 'GROUP_BUY', title: '校内拼单' },
  { key: 'HELP', title: '临时帮忙' }
] as const;

type ServiceCategoryFilter = 'ALL' | CampusServiceCategory;
type ServiceSortKey = 'composite' | 'price_asc' | 'price_desc';
type ServiceCreditFilter = 'ALL' | 'HIGH' | 'VERIFIED';

function getCancelContext(task: CampusServiceListItem | null) {
  const fallback = {
    title: '取消任务',
    okText: '确认取消',
    success: '已取消'
  };

  if (!task) {
    return fallback;
  }

  if (task.actionState.isAccepter && task.status === 'MATCHED') {
    return {
      title: '退出接单',
      okText: '确认退出',
      success: '已退出接单，任务已重新开放'
    };
  }

  if (task.actionState.isPublisher && task.status === 'OPEN') {
    return {
      title: '关闭任务',
      okText: '确认关闭',
      success: '已关闭'
    };
  }

  return fallback;
}

function ServiceMarketCornerPeel() {
  const { peelRef, animate, stop } = usePeel();
  const leaveTimeoutRef = useRef<number | null>(null);

  function clearLeaveTimeout() {
    if (leaveTimeoutRef.current !== null) {
      window.clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    void animate({
      to: { x: 70, y: 34 },
      duration: 1
    });
    return () => {
      clearLeaveTimeout();
      stop();
    };
  }, [animate, stop]);

  async function handleMouseEnter() {
    clearLeaveTimeout();
    stop();
    await animate({
      to: { x: 10, y: 102 },
      duration: 320,
      easing: 'easeOut'
    });
  }

  function handleMouseLeave() {
    clearLeaveTimeout();
    stop();

    leaveTimeoutRef.current = window.setTimeout(() => {
      void animate({
        to: { x: 70, y: 34 },
        duration: 2600,
        easing: 'easeOut'
      });
      leaveTimeoutRef.current = null;
    }, 480);
  }

  return (
    <div
      className="service-market-corner-peel-shell"
      onMouseEnter={() => {
        void handleMouseEnter();
      }}
      onMouseLeave={() => {
        void handleMouseLeave();
      }}
      aria-hidden="true"
    >
      <PeelWrapper
        ref={peelRef}
        className="service-market-corner-peel"
        width={112}
        height={112}
        corner="TOP_RIGHT"
        options={{
          topShadow: true,
          topShadowBlur: 5,
          topShadowAlpha: 0.24,
          topShadowOffsetX: 0,
          topShadowOffsetY: 1,
          backReflection: true,
          backReflectionAlpha: 0.18,
          backReflectionSize: 0.05,
          backShadow: true,
          backShadowSize: 0.06,
          backShadowAlpha: 0.16,
          bottomShadow: false
        }}
        disabled
      >
        <PeelTop className="service-market-corner-peel-top" />
        <PeelBack className="service-market-corner-peel-back" />
        <PeelBottom className="service-market-corner-peel-bottom" />
      </PeelWrapper>
    </div>
  );
}

export function CampusServicesPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuthState();
  const [tasks, setTasks] = useState<CampusServiceListItem[]>([]);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<ServiceCategoryFilter>('ALL');
  const [activeSort, setActiveSort] = useState<ServiceSortKey>('composite');
  const [minReward, setMinReward] = useState<number | null>(null);
  const [maxReward, setMaxReward] = useState<number | null>(null);
  const [activeCreditFilter, setActiveCreditFilter] = useState<ServiceCreditFilter>('ALL');
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [actingTaskId, setActingTaskId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelTarget, setCancelTarget] = useState<CampusServiceListItem | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [total, setTotal] = useState(0);

  async function loadTasks(nextPage = page) {
    setLoading(true);
    try {
      const result = await fetchCampusServiceTasks({
        category: activeCategoryFilter === 'ALL' ? undefined : activeCategoryFilter,
        status: 'OPEN',
        keyword: keyword.trim() || undefined,
        sort: activeSort,
        minReward: minReward ?? undefined,
        maxReward: maxReward ?? undefined,
        credit: activeCreditFilter,
        page: nextPage,
        pageSize
      });
      setTasks(result.items);
      setPage(result.pagination.page);
      setTotal(result.pagination.total);
      setMessage(null);
    } catch (error) {
      setTasks([]);
      setTotal(0);
      setMessage({
        type: 'error',
        text: getApiErrorMessage(error, '校园服务加载失败，请确认 Docker 后端已启动。')
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks(1);
  }, [activeCategoryFilter, activeCreditFilter, activeSort, keyword, maxReward, minReward, pageSize]);

  useEffect(() => {
    if (keywordInput === '' && keyword !== '') {
      setKeyword('');
      setPage(1);
    }
  }, [keyword, keywordInput]);

  async function handleComplete(event: MouseEvent<HTMLButtonElement>, task: CampusServiceListItem) {
    event.stopPropagation();
    setActingTaskId(task.id);
    try {
      await completeCampusServiceTask(task.id);
      await loadTasks();
      setMessage({ type: 'success', text: `“${task.title}”已标记完成。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '标记完成失败，请稍后重试。') });
    } finally {
      setActingTaskId(null);
    }
  }

  async function handleCancelConfirm() {
    if (!cancelTarget) {
      return;
    }

    setActingTaskId(cancelTarget.id);
    try {
      await cancelCampusServiceTask(cancelTarget.id, {
        reason: cancelReason.trim() || undefined
      });
      await loadTasks();
      setCancelTarget(null);
      setCancelReason('');
      setMessage({ type: 'success', text: `“${cancelTarget.title}”${getCancelContext(cancelTarget).success}。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '取消任务失败，请稍后重试。') });
    } finally {
      setActingTaskId(null);
    }
  }

  function jumpToConversation(event: MouseEvent<HTMLButtonElement>, task: CampusServiceListItem) {
    event.stopPropagation();
    if (task.conversationId) {
      void navigate(`/messages?conversationId=${task.conversationId}`);
    }
  }

  const cancelContext = getCancelContext(cancelTarget);

  return (
    <div className="page-grid campus-service-page service-market-page">
      <section className="page-topbar service-market-topbar">
        <ServiceMarketCornerPeel />
      </section>

      {message ? <Alert type={message.type} showIcon message={message.text} closable onClose={() => setMessage(null)} /> : null}

      <section className="service-market-main">
        <ResultFilterBar
          tabs={[
            { key: 'ALL', label: '全部任务' },
            ...moduleConfig.map((item) => ({ key: item.key, label: item.title }))
          ]}
          activeTab={activeCategoryFilter}
          onTabChange={(key) => {
            setActiveCategoryFilter(key as ServiceCategoryFilter);
            setPage(1);
          }}
          sortOptions={[
            { key: 'composite', label: '综合' },
            { key: 'price_asc', label: '价格低到高' },
            { key: 'price_desc', label: '价格高到低' }
          ]}
          activeSort={activeSort}
          onSortChange={(key) => {
            setActiveSort(key as ServiceSortKey);
            setPage(1);
          }}
          minPrice={minReward}
          maxPrice={maxReward}
          onMinPriceChange={(value) => {
            setMinReward(value);
            setPage(1);
          }}
          onMaxPriceChange={(value) => {
            setMaxReward(value);
            setPage(1);
          }}
          creditOptions={[
            { key: 'ALL', label: '全部信用' },
            { key: 'HIGH', label: '高信用' },
            { key: 'VERIFIED', label: '已认证' }
          ]}
          activeCredit={activeCreditFilter}
          onCreditChange={(key) => {
            setActiveCreditFilter(key as ServiceCreditFilter);
            setPage(1);
          }}
          trailingContent={(
            <Input.Search
              allowClear
              placeholder="搜索路线、地点、任务"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onSearch={(value) => {
                setKeywordInput(value);
                setKeyword(value);
                setPage(1);
              }}
            />
          )}
        />

        {loading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <ProductGrid
            items={tasks}
            className="fish-feed-grid service-task-grid"
            emptyState={(
              <EmptyState
                className="is-shell"
                title="当前没有匹配任务"
              />
            )}
            renderItem={(task) => {
              const statusPresentation = getListingStatusPresentation(task.status, task.statusLabel);

              return (
                <ProductSummaryCard
                  key={task.id}
                  item={task}
                  imageSrc="/images/products/demo-square.png"
                  className="profile-fish-card service-task-card"
                  signal={task.route.label}
                  coverMeta={(
                    <div className="service-card-cover-stack">
                      <span className="service-card-cover-type">{task.serviceType.label}</span>
                      <span className="service-card-cover-deadline">{task.deadlineLabel}</span>
                    </div>
                  )}
                  bodyMeta={task.participantSummary.accepterLabel
                    ? `${task.participantSummary.publisherLabel} · ${task.participantSummary.accepterLabel}`
                    : task.participantSummary.publisherLabel}
                  priceValue={task.rewardLabel}
                  priceMeta={task.schedule.summary}
                  tagItems={task.summaryTags.slice(0, 4)}
                  onOpen={() => navigate(`/campus-services/${task.id}`)}
                  secondaryActions={(
                    <>
                      {task.status !== 'OPEN' ? <span className={`service-inline-status is-${statusPresentation.tone}`}>{statusPresentation.label}</span> : null}
                      {task.actionState.canOpenConversation ? (
                        <button type="button" className="fish-item-link" onClick={(event) => jumpToConversation(event, task)}>
                          看消息
                        </button>
                      ) : null}
                      {task.actionState.canComplete ? (
                        <button
                          type="button"
                          className="fish-item-link active"
                          onClick={(event) => void handleComplete(event, task)}
                          disabled={actingTaskId === task.id}
                        >
                          {actingTaskId === task.id ? '处理中' : task.actionLabels.complete ?? '标记完成'}
                        </button>
                      ) : null}
                      {task.actionState.canCancel ? (
                        <button
                          type="button"
                          className="fish-item-link danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCancelTarget(task);
                          }}
                        >
                          {task.actionLabels.cancel ?? '取消'}
                        </button>
                      ) : null}
                    </>
                  )}
                />
              );
            }}
          />
        )}

        {!loading && total > pageSize ? (
          <div className="profile-pagination-row">
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              size="small"
              showSizeChanger={false}
              onChange={(nextPage) => {
                setPage(nextPage);
                void loadTasks(nextPage);
              }}
            />
          </div>
        ) : null}
      </section>

      <Modal
        open={Boolean(cancelTarget)}
        title={cancelContext.title}
        onCancel={() => {
          setCancelTarget(null);
          setCancelReason('');
        }}
        onOk={() => void handleCancelConfirm()}
        okText={cancelContext.okText}
        okButtonProps={{ danger: true, loading: cancelTarget ? actingTaskId === cancelTarget.id : false }}
      >
        <div className="service-cancel-dialog">
          <Input.TextArea
            rows={4}
            value={cancelReason}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setCancelReason(event.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
