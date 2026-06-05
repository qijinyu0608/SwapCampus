import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Empty, Skeleton, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyValueGrid } from '../components/data-display';
import { EmptyState } from '../components/feedback';
import {
  fetchUserProfile,
  fetchUserTrustSummary,
  getApiErrorMessage,
  UserProfile,
  UserTrustSummary
} from '../services/api';
import { getDemoUser, getRoleLabel, hasTradingAccess, isGuestUser } from '../services/session';

function formatIdentity(profile?: UserProfile | null) {
  if (!profile) {
    return '--';
  }

  return profile.verified ? '已实名' : '待实名';
}

export function ProfileDetailPage() {
  const navigate = useNavigate();
  const [user] = useState(() => getDemoUser());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trustSummary, setTrustSummary] = useState<UserTrustSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function load() {
      if (!hasTradingAccess(user)) {
        setLoading(false);
        return;
      }

      try {
        const [profileResult, trustResult] = await Promise.all([
          fetchUserProfile(user!.id),
          fetchUserTrustSummary(user!.id)
        ]);
        setProfile(profileResult);
        setTrustSummary(trustResult);
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error, '个人资料加载失败'));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [user]);

  if (!hasTradingAccess(user)) {
    return (
      <div className="page-grid profile-page">
        <EmptyState
          className="is-shell"
          title={isGuestUser(user) ? '游客模式下暂不支持个人资料详情' : '请使用普通用户账号查看个人资料'}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-grid profile-page">
        <section className="profile-detail-shell">
          <Skeleton active paragraph={{ rows: 8 }} />
        </section>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-grid profile-page">
        <EmptyState className="is-shell" title={errorMessage || '个人资料不存在'} />
      </div>
    );
  }

  const profileInfoItems = [
    { key: 'student-id', label: '学号', value: profile.studentId },
    { key: 'real-name', label: '真实姓名', value: profile.realName },
    { key: 'college', label: '学院', value: profile.college },
    { key: 'phone', label: '手机号', value: profile.phone },
    { key: 'identity-status', label: '实名状态', value: profile.identityStatus },
    { key: 'credit-level', label: '信用等级', value: trustSummary?.creditLevel ?? '正常' }
  ];
  const trustMetricItems = [
    { key: 'completed-orders', label: '已完成交易', value: trustSummary?.completedOrders ?? 0 },
    { key: 'active-orders', label: '进行中订单', value: trustSummary?.activeOrders ?? 0 },
    { key: 'waiting-reviews', label: '待评价', value: trustSummary?.waitingReviews ?? 0 },
    { key: 'response-rate', label: '消息回复率', value: `${trustSummary?.responseRate ?? '--'}%` }
  ];

  return (
    <div className="page-grid profile-page">
      <section className="profile-detail-shell">
        <div className="profile-detail-top">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/profile')}>返回我的闲置</Button>
          <Button type="primary" onClick={() => navigate('/profile')}>编辑资料</Button>
        </div>

        <div className="profile-detail-hero">
          <div className="profile-avatar-badge">
            <span>{profile.name.slice(0, 1)}</span>
          </div>
          <div>
            <h1>{profile.name}</h1>
            <p>{profile.email}</p>
            <div className="profile-detail-tags">
              <Tag color="gold">{formatIdentity(profile)}</Tag>
              <Tag color="green">信用 {profile.creditScore}</Tag>
              <Tag>{getRoleLabel(profile.role)}</Tag>
            </div>
          </div>
        </div>

        <KeyValueGrid items={profileInfoItems} className="profile-detail-grid" />
        <KeyValueGrid items={trustMetricItems} columns={4} className="profile-detail-metrics" />
      </section>
    </div>
  );
}
