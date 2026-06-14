import {
  CalendarOutlined,
  CheckCircleOutlined,
  GiftOutlined,
  SafetyCertificateOutlined,
  StarOutlined
} from '@ant-design/icons';
import { Button, Empty, Spin, Tabs, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/feedback';
import { SectionHeader } from '../components/layout';
import { UserAvatar } from '../components/user/UserAvatar';
import {
  checkInCreditCenter,
  claimCreditMission,
  fetchCreditCenterLedger,
  fetchCreditCenterMissions,
  fetchCreditCenterRewards,
  fetchCreditCenterSummary,
  getApiErrorMessage,
  redeemCreditReward,
  type CreditLedgerItem,
  type CreditMissionItem,
  type CreditRewardItem,
  type CreditCenterSummary
} from '../services/api';
import { useAuthState } from '../services/auth-state';
import { hasTradingAccess } from '../services/session';
import { getUserCreditBadge } from '../utils/userPresentation';

function buildCalendarDays() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay.getDay() + 6) % 7;
  const cells: Array<{ date: number | null; isToday: boolean; isPast: boolean; isFuture: boolean }> = [];

  for (let index = 0; index < offset; index += 1) {
    cells.push({ date: null, isToday: false, isPast: false, isFuture: false });
  }

  for (let date = 1; date <= totalDays; date += 1) {
    cells.push({
      date,
      isToday: now.getDate() === date,
      isPast: date < now.getDate(),
      isFuture: date > now.getDate()
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, isToday: false, isPast: false, isFuture: false });
  }

  return {
    monthLabel: `${year}年${month + 1}月`,
    cells
  };
}

function formatLedgerTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '时间未知';
  }

  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

function getMissionActionLabel(item: CreditMissionItem) {
  if (item.claimed) {
    return '已领取';
  }
  if (item.completed) {
    return '领取';
  }
  return '未完成';
}

function getMissionStatus(item: CreditMissionItem) {
  if (item.claimed) {
    return 'claimed';
  }
  if (item.completed) {
    return 'claimable';
  }
  return 'active';
}

function getMissionCycleLabel(cycleType: CreditMissionItem['cycleType']) {
  if (cycleType === 'once') {
    return '一次性';
  }
  if (cycleType === 'daily') {
    return '每日';
  }
  if (cycleType === 'weekly') {
    return '每周';
  }
  return '每月';
}

function getRewardAvailabilityLabel(item: CreditRewardItem) {
  if (item.redeemed) {
    return '已激活';
  }

  return item.canRedeem ? '可用' : '不可用';
}

function renderRewardPreview(item: CreditRewardItem) {
  if (item.code === 'PROFILE_FRAME_BLUE') {
    return (
      <div className="credit-center-reward-preview is-avatar-frame" aria-hidden="true">
        <UserAvatar src={undefined} alt="" fallbackLabel="林" frame="blue-glow" className="credit-center-reward-avatar" />
      </div>
    );
  }

  return (
    <div className="credit-center-reward-preview is-badge" aria-hidden="true">
      <div className="credit-center-reward-badge">
        <div className="credit-center-reward-badge-crest" />
        <div className="credit-center-reward-badge-core">
          <CheckCircleOutlined />
        </div>
        <div className="credit-center-reward-badge-spark" />
        <span className="credit-center-reward-badge-ribbon left" />
        <span className="credit-center-reward-badge-ribbon right" />
      </div>
    </div>
  );
}

function CreditScoreGauge(props: {
  score: number;
  label: string;
  tone: 'excellent' | 'great' | 'good' | 'stable' | 'low';
}) {
  const radius = 50;
  const stroke = 10;
  const normalizedScore = Math.max(0, Math.min(props.score, 100));
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - normalizedScore / 100);

  return (
    <div className={`credit-score-gauge is-${props.tone}`}>
      <svg viewBox="0 0 128 128" className="credit-score-gauge-svg" aria-hidden="true">
        <circle className="credit-score-gauge-track" cx="64" cy="64" r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="credit-score-gauge-progress"
          cx="64"
          cy="64"
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="credit-score-gauge-copy">
        <strong>{normalizedScore}</strong>
        <span>{props.label}</span>
      </div>
    </div>
  );
}

export function CreditCenterPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuthState();
  const [summary, setSummary] = useState<CreditCenterSummary | null>(null);
  const [missions, setMissions] = useState<CreditMissionItem[]>([]);
  const [ledgerItems, setLedgerItems] = useState<CreditLedgerItem[]>([]);
  const [rewardItems, setRewardItems] = useState<CreditRewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);
  const [actingMissionCode, setActingMissionCode] = useState<string | null>(null);
  const [actingRewardCode, setActingRewardCode] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState<'calendar' | 'rewards' | 'ledger'>('calendar');

  async function loadCreditCenter() {
    setLoading(true);
    try {
      const [summaryResult, missionResult, ledgerResult, rewardResult] = await Promise.all([
        fetchCreditCenterSummary(),
        fetchCreditCenterMissions(),
        fetchCreditCenterLedger(),
        fetchCreditCenterRewards()
      ]);
      setSummary(summaryResult);
      setMissions(missionResult.items);
      setLedgerItems(ledgerResult.items);
      setRewardItems(rewardResult.items);
      setLoadError('');
    } catch (error) {
      setLoadError(getApiErrorMessage(error, '信用中心加载失败'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasTradingAccess(currentUser)) {
      setLoading(false);
      setLoadError('当前账号无法使用信用中心');
      return;
    }

    void loadCreditCenter();
  }, [currentUser]);

  const calendar = useMemo(() => buildCalendarDays(), []);
  const checkedDates = useMemo(() => {
    if (!summary) {
      return new Set<number>();
    }

    const streak = Math.max(0, Math.min(summary.signInStreak, 31));
    const today = new Date().getDate();
    const dates = new Set<number>();
    for (let offset = 0; offset < streak; offset += 1) {
      const value = today - offset;
      if (value > 0) {
        dates.add(value);
      }
    }
    return dates;
  }, [summary]);
  const creditBadge = useMemo(() => getUserCreditBadge(summary?.creditScore), [summary?.creditScore]);
  async function handleCheckIn() {
    setSubmittingCheckIn(true);
    try {
      const result = await checkInCreditCenter();
      message.success(`签到成功，获得 ${result.rewardPoints} 积分`);
      await loadCreditCenter();
    } catch (error) {
      message.error(getApiErrorMessage(error, '签到失败'));
    } finally {
      setSubmittingCheckIn(false);
    }
  }

  async function handleClaimMission(missionCode: string) {
    setActingMissionCode(missionCode);
    try {
      const result = await claimCreditMission(missionCode);
      message.success(`已领取 ${result.rewardPoints} 积分`);
      await loadCreditCenter();
    } catch (error) {
      message.error(getApiErrorMessage(error, '任务领取失败'));
    } finally {
      setActingMissionCode(null);
    }
  }

  async function handleRedeemReward(rewardCode: string) {
    setActingRewardCode(rewardCode);
    try {
      const result = await redeemCreditReward(rewardCode);
      message.success(`兑换成功，消耗 ${result.pointsCost} 积分`);
      await loadCreditCenter();
    } catch (error) {
      message.error(getApiErrorMessage(error, '兑换失败'));
    } finally {
      setActingRewardCode(null);
    }
  }

  if (!hasTradingAccess(currentUser)) {
    return (
      <div className="page-grid profile-page">
        <EmptyState className="is-shell" title="请使用普通用户账号查看信用中心" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-grid profile-page">
        <section className="profile-section-panel credit-center-page-shell">
          <Spin />
        </section>
      </div>
    );
  }

  if (!summary || loadError) {
    return (
      <div className="page-grid profile-page">
        <EmptyState
          className="is-shell"
          title={loadError || '信用中心暂不可用'}
        />
      </div>
    );
  }

  return (
    <div className="page-grid profile-page credit-center-page">
      <section className="credit-center-topbar">
        <Button type="text" className="credit-center-back-button" onClick={() => navigate('/profile')}>返回个人中心</Button>
      </section>

      <section className="credit-center-dashboard">
        <div className="credit-center-stat-card is-credit-gauge">
          <span><SafetyCertificateOutlined /> 信用分</span>
          <CreditScoreGauge
            score={summary.creditScore}
            label={creditBadge.label}
            tone={creditBadge.tone}
          />
          <em>{summary.creditLevel}</em>
        </div>
        <div className="credit-center-stat-card">
          <span><StarOutlined /> 可用积分</span>
          <strong>{summary.availablePoints}</strong>
        </div>
        <div className="credit-center-stat-card">
          <span><CalendarOutlined /> 连续签到</span>
          <strong>{summary.signInStreak}</strong>
        </div>
      </section>

      <section className="profile-section-panel credit-center-tabs-panel">
        <Tabs
          activeKey={activeTab}
          onChange={(value) => setActiveTab(value as 'calendar' | 'rewards' | 'ledger')}
          items={[
            {
              key: 'calendar',
              label: (
                <span className="credit-center-tab-label">
                  <CalendarOutlined />
                  签到日历
                </span>
              ),
              children: (
                <div className="credit-center-tab-content">
                  <div className="credit-center-calendar-layout">
                    <div className="credit-center-calendar-board">
                      <SectionHeader
                        title="签到日历"
                        className="is-spacious"
                      />
                      <div className="credit-center-calendar-weekdays">
                        {['一', '二', '三', '四', '五', '六', '日'].map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                      <div className="credit-center-calendar-grid">
                        {calendar.cells.map((cell, index) => {
                          const isChecked = cell.date !== null && checkedDates.has(cell.date);
                          return (
                            <div
                              key={`${cell.date ?? 'empty'}-${index}`}
                          className={[
                            'credit-center-calendar-cell',
                            cell.isToday ? 'is-today' : '',
                            isChecked ? 'is-checked' : '',
                            !isChecked && cell.isPast ? 'is-missed' : '',
                            cell.isFuture ? 'is-future' : '',
                            cell.date === null ? 'is-empty' : ''
                          ].filter(Boolean).join(' ')}
                        >
                              {cell.date === null ? '' : cell.date}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <aside className="credit-center-checkin-panel">
                      <div className="credit-center-checkin-hero">
                        <strong>{summary.nextCheckInBasePoints + summary.nextCheckInBonusPoints}</strong>
                      </div>
                      <div className="credit-center-checkin-signals">
                        <div className="credit-center-checkin-signal">
                          <span>状态</span>
                          <strong>{summary.checkedInToday ? '已签到' : ''}</strong>
                        </div>
                        <div className="credit-center-checkin-signal">
                          <span>连续</span>
                          <strong>{summary.signInStreak}</strong>
                        </div>
                        <div className="credit-center-checkin-signal">
                          <span>积分</span>
                          <strong>{summary.availablePoints}</strong>
                        </div>
                      </div>
                      <div className="credit-center-checkin-actions">
                        <Button
                          type="primary"
                          icon={<CheckCircleOutlined />}
                          onClick={() => void handleCheckIn()}
                          disabled={summary.checkedInToday}
                          loading={submittingCheckIn}
                        >
                          {summary.checkedInToday ? '已签到' : '签到'}
                        </Button>
                      </div>
                    </aside>
                  </div>
                </div>
              )
            },
            {
              key: 'rewards',
              label: (
                <span className="credit-center-tab-label">
                  <GiftOutlined />
                  积分兑换
                </span>
              ),
              children: (
                <div className="credit-center-tab-content">
                  <SectionHeader title="积分兑换" className="is-spacious" />
                  <div className="credit-center-reward-list">
                    {rewardItems.map((item) => (
                      <div key={item.code} className="credit-center-reward-item">
                        <div className="credit-center-reward-body">
                          <div className="credit-center-reward-copy">
                            <div className="credit-center-reward-headline">
                              <strong>{item.title}</strong>
                            </div>
                            <span>{item.description}</span>
                            <em>{item.code === 'PROFILE_FRAME_BLUE' ? '激活后维持 15 天' : getRewardAvailabilityLabel(item)}</em>
                          </div>
                          {renderRewardPreview(item)}
                        </div>
                        <Button
                          disabled={!item.canRedeem || item.redeemed}
                          loading={actingRewardCode === item.code}
                          onClick={() => void handleRedeemReward(item.code)}
                        >
                          {item.redeemed ? '已激活' : `${item.pointsCost} 积分兑换`}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            },
            {
              key: 'ledger',
              label: (
                <span className="credit-center-tab-label">
                  <StarOutlined />
                  积分流水
                </span>
              ),
              children: (
                <div className="credit-center-tab-content">
                  <SectionHeader title="积分流水" className="is-spacious" />
                  {ledgerItems.length ? (
                    <div className="credit-center-ledger-table">
                      <div className="credit-center-ledger-table-head">
                        <span>事项</span>
                        <span>时间</span>
                        <span>变动</span>
                        <span>余额</span>
                      </div>
                      <div className="credit-center-ledger-list">
                        {ledgerItems.map((item) => (
                          <div key={item.id} className="credit-center-ledger-item">
                            <div className="credit-center-ledger-main">
                              <strong>{item.remark || item.sourceType}</strong>
                            </div>
                            <span className="credit-center-ledger-time">{formatLedgerTime(item.createdAt)}</span>
                            <div className={`credit-center-ledger-value ${item.pointsDelta >= 0 ? 'is-positive' : 'is-negative'}`}>
                              {item.pointsDelta >= 0 ? '+' : ''}{item.pointsDelta}
                            </div>
                            <strong className="credit-center-ledger-balance">{item.balanceAfter}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Empty description="暂无流水" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </div>
              )
            }
          ]}
        />
      </section>
    </div>
  );
}
