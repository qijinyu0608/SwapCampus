import { Alert, Button, Input, Modal, Skeleton } from 'antd';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DetailShell } from '../components/layout';
import { EmptyState } from '../components/feedback';
import {
  ListingDetailHero,
  ListingDetailMetaPanel,
  ListingDetailTagPanel,
  ListingDetailTimelinePanel
} from '../components/listing';
import {
  acceptCampusServiceTask,
  cancelCampusServiceTask,
  completeCampusServiceTask,
  fetchCampusServiceDetail,
  getApiErrorMessage,
  type CampusServiceDetailView
} from '../services/api';
import { useAuthState } from '../services/auth-state';
import { hasTradingAccess, isGuestUser } from '../services/session';
import { getListingStatusPresentation } from '../utils/listingStatus';
import { getUserPresentation } from '../utils/userPresentation';

function getCancelContext(task: CampusServiceDetailView | null) {
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

export function CampusServiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuthState();
  const taskId = Number(id);
  const [task, setTask] = useState<CampusServiceDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingTaskId, setActingTaskId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [acceptMessage, setAcceptMessage] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadTask() {
    setLoading(true);
    try {
      const result = await fetchCampusServiceDetail(taskId);
      setTask(result);
      setMessage(null);
    } catch (error) {
      setTask(null);
      setMessage({
        type: 'error',
        text: getApiErrorMessage(error, '校园服务加载失败，请确认 Docker 后端已启动。')
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(taskId)) {
      setLoading(false);
      setTask(null);
      return;
    }
    void loadTask();
  }, [taskId]);

  async function handleAcceptConfirm() {
    if (!task) {
      return;
    }

    if (!hasTradingAccess(currentUser)) {
      setMessage({
        type: 'error',
        text: isGuestUser(currentUser) ? '浏览账号不能接单。' : '请先登录普通用户账号后再接单。'
      });
      return;
    }

    setActingTaskId(task.id);
    try {
      await acceptCampusServiceTask(task.id, {
        initialMessage: acceptMessage.trim() || undefined
      });
      setAcceptOpen(false);
      setAcceptMessage('');
      await loadTask();
      setMessage({ type: 'success', text: `你已接下“${task.title}”，消息会话已建立。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '接单失败，请稍后重试。') });
    } finally {
      setActingTaskId(null);
    }
  }

  async function handleCancelConfirm() {
    if (!task) {
      return;
    }

    setActingTaskId(task.id);
    try {
      await cancelCampusServiceTask(task.id, {
        reason: cancelReason.trim() || undefined
      });
      setCancelOpen(false);
      setCancelReason('');
      await loadTask();
      setMessage({ type: 'success', text: `“${task.title}”${getCancelContext(task).success}。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '取消任务失败，请稍后重试。') });
    } finally {
      setActingTaskId(null);
    }
  }

  async function handleComplete() {
    if (!task) {
      return;
    }

    setActingTaskId(task.id);
    try {
      await completeCampusServiceTask(task.id);
      await loadTask();
      setMessage({ type: 'success', text: `“${task.title}”已标记完成。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '标记完成失败，请稍后重试。') });
    } finally {
      setActingTaskId(null);
    }
  }

  const cancelContext = useMemo(() => getCancelContext(task), [task]);
  const publisherPresentation = task ? getUserPresentation(task.publisher) : null;
  const statusPresentation = task ? getListingStatusPresentation(task.detailBase.status, task.detailBase.statusLabel) : null;

  return (
    <div className="page-grid campus-service-page">
      <section className="page-topbar">
        <div className="page-topbar-copy">
          <h1>服务详情</h1>
        </div>
      </section>

      {message ? <Alert type={message.type} showIcon message={message.text} closable onClose={() => setMessage(null)} /> : null}

      {loading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : !task ? (
        <EmptyState className="is-shell" title="任务不存在" description="这条校园服务可能已被移除。" />
      ) : (
        <DetailShell
          className="service-detail-shell"
          mainMedia={(
            <ListingDetailHero
              detail={task.detailBase}
              statusTone={statusPresentation?.tone}
              titleAs="h2"
              metrics={task.preview.metrics.map((metric) => (
                <div key={metric.label} className="service-detail-metric">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            />
          )}
          sidePanel={(
            <div className="service-detail-panel">
              <ListingDetailMetaPanel
                detail={task.detailBase}
                extraItems={publisherPresentation
                  ? [{
                      key: 'publisher-credit',
                      label: '发布者信用',
                      value: `${publisherPresentation.creditBadge.label} · ${publisherPresentation.publicIdentityLabel}`
                    }]
                  : undefined}
              />
              <ListingDetailTagPanel detail={task.detailBase} />

              <div className="service-detail-actions">
                <Button onClick={() => navigate('/campus-services')}>返回列表</Button>
                {task.actionState.canOpenConversation ? <Button onClick={() => navigate(`/messages?conversationId=${task.conversationId}`)}>看消息</Button> : null}
                {task.actionState.canCancel ? <Button danger onClick={() => setCancelOpen(true)}>{task.actionLabels.cancel ?? '取消'}</Button> : null}
                {task.actionState.canComplete ? <Button type="primary" onClick={() => void handleComplete()} loading={actingTaskId === task.id}>{task.actionLabels.complete ?? '标记完成'}</Button> : null}
                {task.actionState.canAccept ? <Button type="primary" onClick={() => setAcceptOpen(true)} loading={actingTaskId === task.id}>{task.actionLabels.accept ?? '接单'}</Button> : null}
              </div>
            </div>
          )}
          bottomContent={(
            <ListingDetailTimelinePanel detail={task.detailBase} />
          )}
        />
      )}

      <Modal
        open={acceptOpen}
        title="接下任务"
        onCancel={() => {
          setAcceptOpen(false);
          setAcceptMessage('');
        }}
        onOk={() => void handleAcceptConfirm()}
        okText="确认接单"
        okButtonProps={{ loading: task ? actingTaskId === task.id : false }}
      >
        <Input.TextArea rows={4} value={acceptMessage} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setAcceptMessage(event.target.value)} />
      </Modal>

      <Modal
        open={cancelOpen}
        title={cancelContext.title}
        onCancel={() => {
          setCancelOpen(false);
          setCancelReason('');
        }}
        onOk={() => void handleCancelConfirm()}
        okText={cancelContext.okText}
        okButtonProps={{ danger: true, loading: task ? actingTaskId === task.id : false }}
      >
        <Input.TextArea rows={4} value={cancelReason} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setCancelReason(event.target.value)} />
      </Modal>
    </div>
  );
}
