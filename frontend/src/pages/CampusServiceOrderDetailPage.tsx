import { Alert, Button, Descriptions, Empty, Skeleton, Tag, message } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SectionHeader } from '../components/layout';
import {
  ConfirmActionModal,
  OrderDetailDescriptionsSection,
  OrderDetailEntrySection,
  OrderDetailHeroSection,
  OrderDetailToolbarSection,
  SectionCard
} from '../components/ui';
import { UserNameWithBadge } from '../components/user/UserNameWithBadge';
import {
  cancelCampusServiceOrder,
  completeCampusServiceOrder,
  confirmCampusServiceOrder,
  fetchCampusServiceOrderDetail,
  getApiErrorMessage,
  rejectCampusServiceOrder,
  type CampusServiceOrderDetail
} from '../services/api';
import {
  executeCampusServiceOrderAction,
  getCampusServiceOrderRejectOrCancelText,
  getCampusServiceOrderRequestLabel
} from '../utils/campusServiceOrderActions';
import { getCampusServiceOrderStatusColor } from '../utils/orderStatus';

export function CampusServiceOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CampusServiceOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const orderId = Number(id);

  async function load() {
    if (!Number.isFinite(orderId) || orderId <= 0) {
      setError('缺少有效服务单编号。');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchCampusServiceOrderDetail(orderId);
      setDetail(result);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, '服务单详情加载失败。'));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [orderId]);

  async function handleConfirm() {
    if (!detail) {
      return;
    }
    setActing(true);
    await executeCampusServiceOrderAction({
      run: () => confirmCampusServiceOrder(detail.id),
      onSuccess: () => load(),
      onFinally: () => setActing(false),
      notifySuccess: (text) => message.success(text),
      notifyError: (text) => message.error(text),
      successMessage: `已确认“${detail.title}”的${getCampusServiceOrderRequestLabel(detail)}。`,
      fallbackErrorMessage: '确认失败。'
    });
  }

  async function handleComplete() {
    if (!detail) {
      return;
    }
    setActing(true);
    await executeCampusServiceOrderAction({
      run: () => completeCampusServiceOrder(detail.id),
      onSuccess: () => load(),
      onFinally: () => setActing(false),
      notifySuccess: (text) => message.success(text),
      notifyError: (text) => message.error(text),
      successMessage: `“${detail.title}”已更新为最新进度。`,
      fallbackErrorMessage: '更新进度失败。'
    });
  }

  async function handleReject() {
    if (!detail) {
      return;
    }
    setActing(true);
    await executeCampusServiceOrderAction({
      run: () => rejectCampusServiceOrder(detail.id),
      onSuccess: async () => {
        setCancelOpen(false);
        await load();
      },
      onFinally: () => setActing(false),
      notifySuccess: (text) => message.success(text),
      notifyError: (text) => message.error(text),
      successMessage: `已拒绝“${detail.title}”的${getCampusServiceOrderRequestLabel(detail)}。`,
      fallbackErrorMessage: '拒绝失败。'
    });
  }

  async function handleCancel() {
    if (!detail) {
      return;
    }
    setActing(true);
    await executeCampusServiceOrderAction({
      run: () => cancelCampusServiceOrder(detail.id),
      onSuccess: async () => {
        setCancelOpen(false);
        await load();
      },
      onFinally: () => setActing(false),
      notifySuccess: (text) => message.success(text),
      notifyError: (text) => message.error(text),
      successMessage: `“${detail.title}”已取消。`,
      fallbackErrorMessage: '取消失败。'
    });
  }

  return (
    <div className="page-grid order-detail-page">
      <SectionHeader title="服务单详情" className="is-prominent is-spacious" />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {loading ? (
        <SectionCard>
          <Skeleton active paragraph={{ rows: 10 }} />
        </SectionCard>
      ) : !detail ? (
        <SectionCard>
          <Empty description="未找到服务单信息" />
        </SectionCard>
      ) : (
        <>
          <OrderDetailHeroSection
            title={detail.listingSnapshot.title}
            statusLabel={detail.orderStatusLabel}
            statusColor={getCampusServiceOrderStatusColor(detail.orderStatus)}
            codeLabel="服务单编号"
            codeValue={detail.id}
            counterpartName={detail.counterpart.displayName}
            counterpartTrusted={detail.counterpart.creditScore >= 90}
            amountLabel={detail.rewardLabel}
            imageSrc={detail.listingSnapshot.imageUrl ?? detail.imageUrl ?? ''}
            imageAlt={detail.listingSnapshot.title}
          />

          <OrderDetailToolbarSection>
            {detail.actionState.canConfirm ? (
              <Button type="primary" loading={acting} onClick={() => void handleConfirm()}>
                {detail.actionLabels.confirm ?? '确认'}
              </Button>
            ) : null}
            {detail.actionState.canComplete ? (
              <Button loading={acting} onClick={() => void handleComplete()}>
                {detail.actionLabels.complete ?? '提交进度'}
              </Button>
            ) : null}
            {detail.actionState.canReject ? (
              <Button danger loading={acting} onClick={() => setCancelOpen(true)}>
                {detail.actionLabels.reject ?? '拒绝'}
              </Button>
            ) : null}
            {detail.actionState.canCancel ? (
              <Button danger loading={acting} onClick={() => setCancelOpen(true)}>
                {detail.actionLabels.cancel ?? '取消'}
              </Button>
            ) : null}
            {detail.actionState.canOpenConversation && detail.conversationId ? (
              <Button onClick={() => navigate(`/messages?conversationId=${detail.conversationId}`)}>
                {detail.actionLabels.conversation ?? '看消息'}
              </Button>
            ) : null}
          </OrderDetailToolbarSection>

          <OrderDetailDescriptionsSection
            title="服务单信息"
            items={[
              { key: 'intent', label: '服务方向', value: detail.intentLabel },
              { key: 'category', label: '服务分类', value: detail.categoryLabel },
              { key: 'route', label: '服务路线', value: detail.route.label },
              { key: 'time', label: '服务时间', value: detail.serviceTime || '待更新' },
              { key: 'deadline', label: '截止时间', value: detail.deadlineLabel },
              { key: 'duration', label: '预计耗时', value: `${detail.estimatedMinutes} 分钟` },
              { key: 'note', label: '协作说明', value: detail.note || '无' },
              { key: 'cancelReason', label: '取消原因', value: detail.cancelReason || '无' }
            ]}
          />

          <OrderDetailEntrySection
            title="服务发布详情"
            subtitle={detail.listingSnapshot.title}
            meta={`${detail.listingSnapshot.intentLabel} · ${detail.listingSnapshot.categoryLabel}`}
            onClick={() => navigate(`/campus-services/${detail.listingId}`)}
          />

          <OrderDetailDescriptionsSection
            title="进度时间线"
            items={detail.timeline.map((item) => ({
              key: `${item.label}-${item.value}`,
              label: item.label,
              value: item.value
            }))}
          />
        </>
      )}

      <ConfirmActionModal
        title={detail ? getCampusServiceOrderRejectOrCancelText(detail).title : '处理当前协作'}
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => void (detail?.actionState.canReject ? handleReject() : handleCancel())}
        danger
        loading={acting}
        confirmText={detail ? getCampusServiceOrderRejectOrCancelText(detail).confirmText : '确认'}
        description="该操作会更新当前服务单状态，并同步到双方记录中。"
      />
    </div>
  );
}
