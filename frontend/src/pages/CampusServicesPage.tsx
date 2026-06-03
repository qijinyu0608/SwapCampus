import { Alert, Button, Empty, Form, Input, InputNumber, Pagination, Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FoldSection } from '../components/FoldSection';
import { MetricBarChart } from '../components/MetricBarChart';
import { PageCard } from '../components/PageCard';
import {
  acceptCampusServiceTask,
  CampusServiceCategory,
  CampusServiceStatus,
  CampusServiceTask,
  completeCampusServiceTask,
  createCampusServiceTask,
  fetchCampusServiceTasks,
  getApiErrorMessage
} from '../services/api';
import { bjfuLocationSections, bjfuServiceRoutePresets } from '../constants/campus';
import { getDemoUser, getRoleLabel, hasTradingAccess, isGuestUser } from '../services/session';

const moduleConfig: Array<{
  key: CampusServiceCategory;
  title: string;
  subtitle: string;
  tone: 'amber' | 'sky' | 'mint' | 'peach';
}> = [
  { key: 'ERRAND', title: '校园跑腿', subtitle: '取快递 / 送资料 / 带饭', tone: 'amber' },
  { key: 'AGENCY', title: '代办代取', subtitle: '打印 / 盖章 / 借书 / 排队', tone: 'sky' },
  { key: 'GROUP_BUY', title: '校内拼单', subtitle: '奶茶 / 零食 / 打印 / 外卖', tone: 'mint' },
  { key: 'HELP', title: '临时帮忙', subtitle: '搬宿舍 / 看包 / 代签到', tone: 'peach' }
];

const categoryLabelMap: Record<CampusServiceCategory, string> = {
  ERRAND: '跑腿',
  AGENCY: '代办',
  GROUP_BUY: '拼单',
  HELP: '临时帮忙'
};

const statusLabelMap: Record<CampusServiceStatus, string> = {
  OPEN: '待接单',
  MATCHED: '进行中',
  DONE: '已完成',
  CANCELED: '已取消'
};

const serviceRules = [
  '仅限本校认证账号发布与接单',
  '优先展示同校、同区域、最近活跃用户',
  '敏感证件、违规代课等任务禁止发布',
  '高价值任务建议使用当面确认与信用担保'
];

const TASK_PAGE_SIZE = 5;

type CategoryFilter = CampusServiceCategory | 'ALL';
type StatusFilter = CampusServiceStatus | 'ALL';

export function CampusServicesPage() {
  const navigate = useNavigate();
  const currentUser = getDemoUser();
  const [form] = Form.useForm();
  const [tasks, setTasks] = useState<CampusServiceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('ALL');
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('OPEN');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [taskPage, setTaskPage] = useState(1);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadTasks() {
    setLoading(true);
    try {
      const list = await fetchCampusServiceTasks();
      setTasks(list);
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '校园服务加载失败，请确认后端已启动并完成数据库同步。') });
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  const myPublishedCount = currentUser
    ? tasks.filter((task) => task.publisher.id === currentUser.id).length
    : 0;
  const myAcceptedCount = currentUser
    ? tasks.filter((task) => task.accepter?.id === currentUser.id && task.status === 'MATCHED').length
    : 0;
  const hasPublishedTasks = myPublishedCount > 0;

  useEffect(() => {
    if (!hasPublishedTasks && activeStatus !== 'OPEN') {
      setActiveStatus('OPEN');
    }
  }, [activeStatus, hasPublishedTasks]);

  useEffect(() => {
    setTaskPage(1);
    setExpandedTaskId(null);
  }, [activeCategory, activeStatus, searchKeyword]);

  const visibleTasks = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return tasks.filter((task) => {
      const isOwner = currentUser?.id === task.publisher.id;
      const canSeeTask = task.status === 'OPEN' || isOwner;
      if (!canSeeTask) {
        return false;
      }

      const matchesCategory = activeCategory === 'ALL' || task.category === activeCategory;
      const matchesStatus = activeStatus === 'ALL' || task.status === activeStatus;
      const matchesKeyword = !keyword || [
        task.title,
        task.description,
        task.locationFrom,
        task.locationTo,
        task.publisher.name,
        task.accepter?.name,
        categoryLabelMap[task.category]
      ].filter(Boolean).join(' ').toLowerCase().includes(keyword);

      return matchesCategory && matchesStatus && matchesKeyword;
    });
  }, [activeCategory, activeStatus, currentUser?.id, searchKeyword, tasks]);

  const pagedVisibleTasks = useMemo(() => {
    const maxPage = Math.max(1, Math.ceil(visibleTasks.length / TASK_PAGE_SIZE));
    const safePage = Math.min(taskPage, maxPage);
    const start = (safePage - 1) * TASK_PAGE_SIZE;

    return visibleTasks.slice(start, start + TASK_PAGE_SIZE);
  }, [taskPage, visibleTasks]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(visibleTasks.length / TASK_PAGE_SIZE));
    if (taskPage > maxPage) {
      setTaskPage(maxPage);
    }
  }, [taskPage, visibleTasks.length]);

  const stats = useMemo(() => {
    const openTasks = tasks.filter((task) => task.status === 'OPEN');
    const avgMinutes = openTasks.length > 0
      ? Math.round(openTasks.reduce((sum, task) => sum + task.estimatedMinutes, 0) / openTasks.length)
      : 0;

    return {
      openCount: openTasks.length,
      avgMinutes,
      chartItems: moduleConfig.map((item) => {
        const count = openTasks.filter((task) => task.category === item.key).length;
        return {
          label: categoryLabelMap[item.key],
          value: count,
          displayValue: String(count),
          tone: item.tone === 'sky' ? 'blue' as const : item.tone === 'mint' ? 'green' as const : 'amber' as const
        };
      })
    };
  }, [tasks]);

  const compactOpenCount = tasks.filter((task) => task.status === 'OPEN').length;
  const hasOpenTasks = compactOpenCount > 0;
  const shouldShowDiscovery = hasOpenTasks || hasPublishedTasks || Boolean(searchKeyword.trim()) || activeCategory !== 'ALL' || activeStatus !== 'OPEN';
  const currentCategoryLabel = activeCategory === 'ALL' ? '全部类型' : moduleConfig.find((item) => item.key === activeCategory)?.title ?? '全部类型';
  const statusFilterOptions = hasPublishedTasks
    ? [
        { value: 'ALL', label: '我发布 / 待接' },
        { value: 'OPEN', label: '待接单' },
        { value: 'MATCHED', label: '我发布的进行中' },
        { value: 'DONE', label: '我发布的已完成' }
      ]
    : [
        { value: 'OPEN', label: '待接单' }
      ];
  const currentStatusLabel = statusFilterOptions.find((item) => item.value === activeStatus)?.label
    ?? (activeStatus === 'ALL' ? '我发布 / 待接' : statusLabelMap[activeStatus]);

  async function handlePublish(values: {
    title: string;
    category: CampusServiceCategory;
    description: string;
    reward: number;
    locationFrom: string;
    locationTo: string;
    deadlineLabel: string;
    estimatedMinutes: number;
  }) {
    if (!hasTradingAccess(currentUser)) {
      setMessage({
        type: 'error',
        text: isGuestUser(currentUser) ? '浏览账号不能发布校园服务任务。' : '请先登录普通用户账号后再发布。'
      });
      return;
    }

    if (!currentUser) {
      return;
    }

    setSubmitting(true);
    try {
      await createCampusServiceTask({
        publisherId: currentUser.id,
        ...values
      });
      await loadTasks();
      setActiveCategory(values.category);
      setActiveStatus('OPEN');
      setMessage({ type: 'success', text: `已发布“${values.title}”，现在其他同学可以直接接单。` });
      form.resetFields();
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '发布失败，请稍后重试。') });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAccept(taskId: number) {
    if (!hasTradingAccess(currentUser)) {
      setMessage({
        type: 'error',
        text: isGuestUser(currentUser) ? '浏览账号不能接单。' : '请先登录普通用户账号后再接单。'
      });
      return;
    }

    if (!currentUser) {
      return;
    }

    try {
      await acceptCampusServiceTask(taskId, { userId: currentUser.id });
      await loadTasks();
      setMessage({ type: 'success', text: '已接单，系统也帮你建立了消息会话。' });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '接单失败，请稍后重试。') });
    }
  }

  async function handleComplete(taskId: number) {
    if (!currentUser) {
      return;
    }

    try {
      await completeCampusServiceTask(taskId, { userId: currentUser.id });
      await loadTasks();
      setMessage({ type: 'success', text: '任务已标记完成。' });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '标记完成失败，请稍后重试。') });
    }
  }

  return (
    <div className="page-grid campus-service-page">
      <section className="page-topbar">
        <div className="page-topbar-copy">
          <h1>校园服务</h1>
          <span>先看待接任务，需要时再展开筛选、发布和规则</span>
        </div>
        <div className="page-topbar-tags">
          <span>{currentUser ? `${currentUser.name} · ${getRoleLabel(currentUser.role)}` : '未登录'}</span>
          <span>同校认证</span>
          <span>信用接单</span>
        </div>
      </section>

      <section className="service-focus-panel">
        <div>
          <strong>{hasOpenTasks ? `当前有 ${stats.openCount} 个待接任务` : '当前暂无待接任务'}</strong>
          <span>{hasOpenTasks
            ? currentUser ? `我发布 ${myPublishedCount} 条 · 我在接 ${myAcceptedCount} 条` : '登录后可以发布和接单'
            : '可以发布一个委托，或稍后回来查看新任务'}</span>
        </div>
        <div className="service-focus-actions">
          <Button
            type="primary"
            onClick={() => {
              if (hasOpenTasks) {
                setActiveStatus('OPEN');
                return;
              }

              document.getElementById('service-publish-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            {hasOpenTasks ? '只看待接' : '发布委托'}
          </Button>
          <Button onClick={() => {
            if (!hasOpenTasks) {
              void loadTasks();
              return;
            }

            setActiveCategory('ALL');
            setActiveStatus('OPEN');
            setSearchKeyword('');
          }}>
            {hasOpenTasks ? '清空筛选' : '刷新列表'}
          </Button>
        </div>
      </section>

      {message ? <Alert type={message.type} showIcon message={message.text} closable onClose={() => setMessage(null)} /> : null}

      <div className={shouldShowDiscovery ? 'two-col service-layout' : 'two-col service-layout empty'}>
        <div className="page-grid">
          {shouldShowDiscovery ? (
            <PageCard>
              <div className="service-sidebar-head">
                <strong>按类型找服务</strong>
                <span>{currentCategoryLabel}</span>
              </div>
              <div className="service-module-grid">
                <button
                  type="button"
                  className={`service-module-card tone-neutral${activeCategory === 'ALL' ? ' active' : ''}`}
                  onClick={() => setActiveCategory('ALL')}
                >
                  <div className="service-module-copy">
                    <strong>全部服务</strong>
                    <span>先看所有待处理委托</span>
                  </div>
                  <em>{`待接 ${stats.openCount}`}</em>
                </button>
                {moduleConfig.map((item) => {
                  const total = tasks.filter((task) =>
                    task.category === item.key &&
                    (task.status === 'OPEN' || task.publisher.id === currentUser?.id)
                  ).length;
                  const open = tasks.filter((task) => task.category === item.key && task.status === 'OPEN').length;
                  const isActive = activeCategory === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`service-module-card tone-${item.tone}${isActive ? ' active' : ''}`}
                      onClick={() => setActiveCategory(item.key)}
                    >
                      <div className="service-module-copy">
                        <strong>{item.title}</strong>
                        <span>{item.subtitle}</span>
                      </div>
                      <em>{hasPublishedTasks ? `待接 ${open} · 可见 ${total}` : `待接 ${open}`}</em>
                    </button>
                  );
                })}
              </div>
              <FoldSection title="待接热度" meta={`${stats.openCount} 单`} compact>
                <div className="dashboard-card compact service-fold-block">
                  <MetricBarChart items={stats.chartItems} maxValue={Math.max(stats.openCount, 1)} />
                </div>
              </FoldSection>
              <FoldSection title="常用路线" meta="4 条预设" compact>
                <div className="service-route-strip">
                  {bjfuServiceRoutePresets.slice(0, 4).map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="service-route-chip"
                      onClick={() => setSearchKeyword(`${item.from} ${item.to}`)}
                    >
                      <strong>{item.label}</strong>
                      <span>{`${item.from} -> ${item.to}`}</span>
                    </button>
                  ))}
                </div>
              </FoldSection>
            </PageCard>
          ) : (
            <PageCard>
              <div className="service-empty-guide">
                <strong>现在没有可接的校园服务</strong>
                <span>接单列表会在有同学发布新委托后出现。当前不展示分类和筛选，避免把空数据当成任务进度。</span>
              </div>
            </PageCard>
          )}

          <div id="service-publish-card">
            <PageCard>
              <FoldSection title="发布委托" meta={hasOpenTasks ? '展开填写任务' : '可以先发布一个需求'} defaultOpen={!shouldShowDiscovery} compact>
              <div className="service-compose-head">
                <strong>发布跑腿服务</strong>
                <span>{currentUser ? `我发布 ${myPublishedCount} 条 · 我在接 ${myAcceptedCount} 条` : '登录后可发布和接单'}</span>
              </div>
              <Form form={form} layout="vertical" onFinish={handlePublish} className="form-shell service-publish-form">
                <div className="service-publish-grid">
                  <Form.Item name="title" label="任务标题" rules={[{ required: true }]}>
                    <Input placeholder="例如：西门快递代取 3 件" />
                  </Form.Item>
                  <Form.Item name="category" label="服务类型" rules={[{ required: true }]}>
                    <Select
                      options={moduleConfig.map((item) => ({
                        value: item.key,
                        label: item.title
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="reward" label="酬谢金额" rules={[{ required: true }]}>
                    <InputNumber min={1} style={{ width: '100%' }} prefix="¥" />
                  </Form.Item>
                  <Form.Item name="estimatedMinutes" label="预计耗时" rules={[{ required: true }]}>
                    <InputNumber min={5} max={180} style={{ width: '100%' }} suffix="分钟" />
                  </Form.Item>
                  <Form.Item name="locationFrom" label="出发 / 办理点" rules={[{ required: true }]}>
                    <Input placeholder="例如：东门 / 学一食堂 / 学研中心B座" />
                  </Form.Item>
                  <Form.Item name="locationTo" label="送达 / 结果点" rules={[{ required: true }]}>
                    <Input placeholder="例如：13号公寓 / 图书馆 / 主楼" />
                  </Form.Item>
                </div>
                <Form.Item name="deadlineLabel" label="截止时间" rules={[{ required: true }]}>
                  <Input placeholder="例如：今晚 20:30 前" />
                </Form.Item>
                <Form.Item name="description" label="任务说明" rules={[{ required: true }]}>
                  <Input.TextArea rows={3} placeholder="补充件数、顺路要求、注意事项" />
                </Form.Item>
                <div className="publish-submit-row service-submit-row">
                  <span className="meta-line">发布后进入右侧委托列表</span>
                  <Button type="primary" htmlType="submit" loading={submitting}>发布委托</Button>
                </div>
              </Form>
              <FoldSection title="常用地点" meta="点击填入出发点" compact>
                <div className="service-location-board">
                  {bjfuLocationSections.slice(0, 6).map((section) => (
                    <div key={section.label} className="service-location-group">
                      <strong>{section.label}</strong>
                      <div className="service-location-tags">
                        {section.items.slice(0, 6).map((item) => (
                          <button
                            key={item}
                            type="button"
                            className="service-location-tag"
                            onClick={() => form.setFieldsValue({ locationFrom: item })}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </FoldSection>
            </FoldSection>
            </PageCard>
          </div>

          <PageCard>
            <FoldSection title="接单规则" meta={`${serviceRules.length} 条`} compact>
              <div className="service-rule-strip">
                {serviceRules.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </FoldSection>
          </PageCard>
        </div>

        {shouldShowDiscovery ? (
          <PageCard>
          <div className="service-list-panel">
          <div className="service-list-head">
            <div>
              <strong>服务委托</strong>
              <span>{`${currentStatusLabel} · ${currentCategoryLabel}`}</span>
            </div>
            <button
              type="button"
              className="fish-item-link"
              onClick={() => navigate('/messages?channel=service')}
            >
              看消息
            </button>
          </div>
          <div className="service-compact-strip">
            <span>{`待接 ${compactOpenCount}`}</span>
            <span>{`平均 ${stats.avgMinutes} 分钟`}</span>
            {hasPublishedTasks ? <span>含我发布的进度</span> : <span>仅显示待接任务</span>}
          </div>
          <Input
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="搜索地点、任务、发布者"
            className="service-primary-search"
          />
          <FoldSection title="筛选" meta={`${currentStatusLabel} / ${currentCategoryLabel}`} compact>
            <div className="service-filter-bar">
              <Select
                value={activeStatus}
                onChange={(value) => setActiveStatus(value)}
                options={statusFilterOptions}
              />
              <Select
                value={activeCategory}
                onChange={(value) => setActiveCategory(value)}
                options={[
                  { value: 'ALL', label: '全部类型' },
                  ...moduleConfig.map((item) => ({
                    value: item.key,
                    label: item.title
                  }))
                ]}
              />
              <Button onClick={() => {
                setActiveCategory('ALL');
                setActiveStatus('OPEN');
                setSearchKeyword('');
              }}>重置</Button>
            </div>
          </FoldSection>
          {loading ? (
            <div className="service-empty-state">
              <strong>正在加载校园服务</strong>
              <span>请稍等一下，马上就好。</span>
            </div>
          ) : visibleTasks.length ? (
            <>
            <div className="service-task-list">
              {pagedVisibleTasks.map((item) => {
                const isOwner = currentUser?.id === item.publisher.id;
                const isAcceptor = currentUser?.id === item.accepter?.id;
                const canAccept = item.status === 'OPEN' && !isOwner;
                const canComplete = item.status === 'MATCHED' && (isOwner || isAcceptor);
                const canOpenConversation = Boolean(item.conversationId && (isOwner || isAcceptor));
                const isExpanded = expandedTaskId === item.id;

                return (
                  <article key={item.id} className="service-task-item interactive">
                    <div className="service-task-copy">
                      <div className="service-task-title-row">
                        <strong>{item.title}</strong>
                        <span className={`service-status-badge status-${item.status.toLowerCase()}`}>{statusLabelMap[item.status]}</span>
                      </div>
                      <span>{`${categoryLabelMap[item.category]} · ${item.locationFrom} -> ${item.locationTo}`}</span>
                      <div className={isExpanded ? 'service-task-detail' : 'service-task-detail collapsed'}>
                        <span>{`${item.deadlineLabel} · 发布者 ${item.publisher.name}${item.accepter ? ` · 接单人 ${item.accepter.name}` : ''}`}</span>
                        <p>{item.description}</p>
                        <div className="service-task-roles">
                          {canOpenConversation ? (
                            <button
                              type="button"
                              className="service-task-role"
                              onClick={() => navigate(`/messages?conversationId=${item.conversationId}`)}
                            >
                              已建会话
                            </button>
                          ) : null}
                          {isOwner ? <span className="service-task-role">我发布的</span> : null}
                          {isAcceptor && item.status === 'MATCHED' ? <span className="service-task-role">我在处理</span> : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="service-task-detail-toggle"
                        onClick={() => setExpandedTaskId(isExpanded ? null : item.id)}
                      >
                        {isExpanded ? '收起详情' : '查看详情'}
                      </button>
                    </div>
                    <div className="service-task-side">
                      <em>{`¥${item.reward}`}</em>
                      {canAccept ? <Button type="primary" size="small" onClick={() => void handleAccept(item.id)}>接单</Button> : null}
                      {canComplete ? <Button size="small" onClick={() => void handleComplete(item.id)}>标记完成</Button> : null}
                    </div>
                  </article>
                );
              })}
            </div>
            {visibleTasks.length > TASK_PAGE_SIZE ? (
              <div className="service-pagination-row">
                <span>{`第 ${taskPage} / ${Math.ceil(visibleTasks.length / TASK_PAGE_SIZE)} 页`}</span>
                <Pagination
                  current={taskPage}
                  pageSize={TASK_PAGE_SIZE}
                  total={visibleTasks.length}
                  size="small"
                  showSizeChanger={false}
                  onChange={(page) => {
                    setTaskPage(page);
                    setExpandedTaskId(null);
                  }}
                />
              </div>
            ) : null}
            </>
          ) : (
            <Empty description="当前筛选下还没有任务" />
          )}
          </div>
          </PageCard>
        ) : null}
      </div>
    </div>
  );
}
