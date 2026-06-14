import {
  Alert,
  Input,
  Modal,
  Pagination,
  Skeleton
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { PeelBack, PeelBottom, PeelTop, PeelWrapper, usePeel } from 'react-peel';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/feedback';
import { ProductGrid, ProductSummaryCard, ResultFilterBar } from '../components/product';
import { CAMPUS_SERVICE_CATEGORY_LABEL, CAMPUS_SERVICE_CATEGORY_OPTIONS } from '../constants/campusServiceCategories';
import { useAuthState } from '../services/auth-state';
import {
  acceptCampusServiceListing,
  cancelCampusServiceListing,
  cancelCampusServiceOrder,
  type CampusServiceCategory,
  type CampusServiceListItem,
  completeCampusServiceOrder,
  confirmCampusServiceOrder,
  endCampusServiceListing,
  fetchCampusServiceListings,
  getApiErrorMessage,
  pauseCampusServiceListing,
  reopenCampusServiceListing,
  rejectCampusServiceOrder
} from '../services/api';
import { getListingStatusPresentation } from '../utils/listingStatus';
import { resolvePrimaryProductImage } from '../utils/productCover';

type ServiceSortKey = 'composite' | 'price_asc' | 'price_desc';
type ServiceCreditFilter = 'EXCELLENT' | 'STABLE' | 'NORMAL' | 'IMPROVE';

const CREDIT_FILTER_OPTIONS: Array<{ key: ServiceCreditFilter; label: string }> = [
  { key: 'EXCELLENT', label: '优秀' },
  { key: 'STABLE', label: '稳定' },
  { key: 'NORMAL', label: '普通' },
  { key: 'IMPROVE', label: '待提升' }
];

function getCancelContext(listing: CampusServiceListItem | null) {
  const fallback = {
    title: '结束服务',
    okText: '确认取消',
    success: '已取消'
  };

  if (!listing) {
    return fallback;
  }

  if (listing.actionState.canReject) {
    return {
      title: listing.actionLabels.reject ?? '拒绝申请',
      okText: listing.actionLabels.reject ?? '确认拒绝',
      success: '已拒绝'
    };
  }

  if (listing.actionState.isParticipant) {
    return {
      title: listing.intent === 'REQUEST' ? '退出接单' : '取消预约',
      okText: '确认退出',
      success: listing.intent === 'REQUEST' ? '已退出接单，服务已重新开放' : '已取消预约'
    };
  }

  if (listing.actionState.isPublisher && listing.status === 'OPEN') {
    return {
      title: listing.actionLabels.cancel ?? '关闭发布',
      okText: listing.actionLabels.cancel ?? '确认关闭',
      success: listing.actionLabels.cancel === '取消当前服务单' ? '已取消当前服务单' : '已结束发布'
    };
  }

  if (listing.actionState.canEnd) {
    return {
      title: listing.actionLabels.end ?? '结束发布',
      okText: listing.actionLabels.end ?? '确认结束',
      success: '已结束发布'
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
  const [listings, setListings] = useState<CampusServiceListItem[]>([]);
  const [activeCategories, setActiveCategories] = useState<CampusServiceCategory[]>([]);
  const [activeIntent, setActiveIntent] = useState<'REQUEST' | 'OFFER'>('REQUEST');
  const [activeSort, setActiveSort] = useState<ServiceSortKey>('composite');
  const [minReward, setMinReward] = useState<number | null>(null);
  const [maxReward, setMaxReward] = useState<number | null>(null);
  const [activeCreditFilters, setActiveCreditFilters] = useState<ServiceCreditFilter[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [actingListingId, setActingListingId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelTarget, setCancelTarget] = useState<CampusServiceListItem | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [total, setTotal] = useState(0);
  const categoryOptions = useMemo(() => {
    return CAMPUS_SERVICE_CATEGORY_OPTIONS
      .filter((item) => item.key !== 'HELP')
      .map((item) => ({
        key: item.key,
        label: CAMPUS_SERVICE_CATEGORY_LABEL[item.key] ?? item.title
      }));
  }, [activeIntent, listings]);

  function submitKeywordSearch(nextKeyword: string) {
    const trimmed = nextKeyword.trim();
    setKeywordInput(nextKeyword);
    setKeyword(trimmed);
    setPage(1);
  }

  function toggleCreditFilter(key: ServiceCreditFilter) {
    setActiveCreditFilters((current) => (
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    ));
    setPage(1);
  }

  function toggleCategoryFilter(key: CampusServiceCategory) {
    setActiveCategories((current) => (
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    ));
    setPage(1);
  }

  async function loadListings(nextPage = page) {
    setLoading(true);
    try {
      const result = await fetchCampusServiceListings({
        intent: activeIntent,
        categories: activeCategories.length ? activeCategories : undefined,
        status: 'OPEN',
        keyword: keyword.trim() || undefined,
        sort: activeSort,
        minReward: minReward ?? undefined,
        maxReward: maxReward ?? undefined,
        credit: activeCreditFilters.length ? activeCreditFilters : undefined,
        page: nextPage,
        pageSize
      });
      setListings(result.items);
      setPage(result.pagination.page);
      setTotal(result.pagination.total);
      setMessage(null);
    } catch (error) {
      setListings([]);
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
    void loadListings(1);
  }, [activeCategories, activeCreditFilters, activeIntent, activeSort, keyword, maxReward, minReward, pageSize]);

  useEffect(() => {
    if (keywordInput === '' && keyword !== '') {
      setKeyword('');
      setPage(1);
    }
  }, [keyword, keywordInput]);

  async function handleComplete(event: MouseEvent<HTMLButtonElement>, listing: CampusServiceListItem) {
    event.stopPropagation();
    if (!listing.actionOrderId) {
      return;
    }
    setActingListingId(listing.id);
    try {
      await completeCampusServiceOrder(listing.actionOrderId);
      await loadListings();
      setMessage({ type: 'success', text: `“${listing.title}”已标记完成。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '标记完成失败，请稍后重试。') });
    } finally {
      setActingListingId(null);
    }
  }

  async function handleCancelConfirm() {
    if (!cancelTarget) {
      return;
    }

    setActingListingId(cancelTarget.id);
    try {
      if (cancelTarget.actionState.isParticipant && cancelTarget.actionOrderId) {
        await cancelCampusServiceOrder(cancelTarget.actionOrderId, {
          reason: cancelReason.trim() || undefined
        });
      } else if (cancelTarget.actionState.canEnd && !cancelTarget.actionState.canCancel) {
        await endCampusServiceListing(cancelTarget.id, {
          reason: cancelReason.trim() || undefined
        });
      } else {
        await cancelCampusServiceListing(cancelTarget.id, {
          reason: cancelReason.trim() || undefined
        });
      }
      await loadListings();
      setCancelTarget(null);
      setCancelReason('');
      setMessage({ type: 'success', text: `“${cancelTarget.title}”${getCancelContext(cancelTarget).success}。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '取消任务失败，请稍后重试。') });
    } finally {
      setActingListingId(null);
    }
  }

  async function handlePause(event: MouseEvent<HTMLButtonElement>, listing: CampusServiceListItem) {
    event.stopPropagation();
    setActingListingId(listing.id);
    try {
      await pauseCampusServiceListing(listing.id);
      await loadListings();
      setMessage({ type: 'success', text: `“${listing.title}”已暂停接新单。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '暂停失败，请稍后重试。') });
    } finally {
      setActingListingId(null);
    }
  }

  async function handleReopen(event: MouseEvent<HTMLButtonElement>, listing: CampusServiceListItem) {
    event.stopPropagation();
    setActingListingId(listing.id);
    try {
      await reopenCampusServiceListing(listing.id);
      await loadListings();
      setMessage({ type: 'success', text: `“${listing.title}”已重新开放。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '重新开放失败，请稍后重试。') });
    } finally {
      setActingListingId(null);
    }
  }

  async function handleConfirmOrder(event: MouseEvent<HTMLButtonElement>, listing: CampusServiceListItem) {
    event.stopPropagation();
    if (!listing.actionOrderId) {
      return;
    }

    setActingListingId(listing.id);
    try {
      await confirmCampusServiceOrder(listing.actionOrderId);
      await loadListings();
      setMessage({ type: 'success', text: `已确认“${listing.title}”的服务单。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '确认服务单失败，请稍后重试。') });
    } finally {
      setActingListingId(null);
    }
  }

  async function handleRejectOrder(event: MouseEvent<HTMLButtonElement>, listing: CampusServiceListItem) {
    event.stopPropagation();
    if (!listing.actionOrderId) {
      return;
    }

    setActingListingId(listing.id);
    try {
      await rejectCampusServiceOrder(listing.actionOrderId);
      await loadListings();
      setMessage({ type: 'success', text: `已拒绝“${listing.title}”的服务申请。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '拒绝服务单失败，请稍后重试。') });
    } finally {
      setActingListingId(null);
    }
  }

  function jumpToConversation(event: MouseEvent<HTMLButtonElement>, listing: CampusServiceListItem) {
    event.stopPropagation();
    if (listing.conversationId) {
      void navigate(`/messages?conversationId=${listing.conversationId}`);
    }
  }

  const cancelContext = getCancelContext(cancelTarget);

  return (
    <div className="page-grid campus-service-page service-market-page">
      <section className="page-topbar service-market-topbar">
        <section className="fish-search-shell service-market-search" aria-label="校园服务搜索">
          <div className="fish-search-row">
            <div className="fish-search-box">
              <Input
                size="large"
                prefix={<SearchOutlined />}
                placeholder="搜索路线、地点、任务"
                bordered={false}
                allowClear
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                onPressEnter={() => submitKeywordSearch(keywordInput)}
              />
              <button
                type="button"
                className="fish-search-button fish-search-button-home"
                onClick={() => submitKeywordSearch(keywordInput)}
              >
                搜索
              </button>
            </div>
          </div>
        </section>

        <ServiceMarketCornerPeel />
      </section>

      {message ? <Alert type={message.type} showIcon message={message.text} closable onClose={() => setMessage(null)} /> : null}

      <section className="service-market-main">
        <ResultFilterBar
          categoryOptions={categoryOptions}
          activeCategories={activeCategories}
          onCategoryToggle={(key) => toggleCategoryFilter(key as CampusServiceCategory)}
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
          creditOptions={CREDIT_FILTER_OPTIONS}
          activeCredits={activeCreditFilters}
          onCreditToggle={(key) => toggleCreditFilter(key as ServiceCreditFilter)}
          trailingContent={(
            <div className="result-filter-segment" role="tablist" aria-label="服务方向">
              <button
                type="button"
                className={activeIntent === 'REQUEST' ? 'result-filter-control active' : 'result-filter-control'}
                onClick={() => {
                  setActiveIntent('REQUEST');
                  setPage(1);
                }}
              >
                找人帮我
              </button>
              <button
                type="button"
                className={activeIntent === 'OFFER' ? 'result-filter-control active' : 'result-filter-control'}
                onClick={() => {
                  setActiveIntent('OFFER');
                  setPage(1);
                }}
              >
                我来提供
              </button>
            </div>
          )}
        />

        {loading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <ProductGrid
            items={listings}
            className="fish-feed-grid service-task-grid"
            emptyState={(
              <EmptyState
                className="is-shell"
                title="暂无任务"
              />
            )}
            renderItem={(listing) => {
              return (
                <ProductSummaryCard
                  key={listing.id}
                  item={listing}
                  imageSrc={resolvePrimaryProductImage({
                    title: listing.title,
                    category: listing.categoryLabel,
                    price: listing.reward,
                    imageUrl: listing.imageUrl
                  }, listing.id)}
                  className="profile-fish-card service-task-card"
                  priceValue={listing.rewardLabel}
                  onOpen={() => navigate(`/campus-services/${listing.id}`)}
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
                void loadListings(nextPage);
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
        okButtonProps={{ danger: true, loading: cancelTarget ? actingListingId === cancelTarget.id : false }}
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
