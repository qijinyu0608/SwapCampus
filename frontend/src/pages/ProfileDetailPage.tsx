import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Empty, Skeleton, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
        <div className="profile-empty-shell">
          <Empty description={isGuestUser(user) ? '游客模式下暂不支持个人资料详情' : '请使用普通用户账号查看个人资料'} />
        </div>
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
        <div className="profile-empty-shell">
          <Empty description={errorMessage || '个人资料不存在'} />
        </div>
      </div>
    );
  }

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

        <div className="profile-detail-grid">
          <div>
            <span>学号</span>
            <strong>{profile.studentId}</strong>
          </div>
          <div>
            <span>真实姓名</span>
            <strong>{profile.realName}</strong>
          </div>
          <div>
            <span>学院</span>
            <strong>{profile.college}</strong>
          </div>
          <div>
            <span>手机号</span>
            <strong>{profile.phone}</strong>
          </div>
          <div>
            <span>实名状态</span>
            <strong>{profile.identityStatus}</strong>
          </div>
          <div>
            <span>信用等级</span>
            <strong>{trustSummary?.creditLevel ?? '正常'}</strong>
          </div>
        </div>

        <div className="profile-detail-metrics">
          <div>
            <strong>{trustSummary?.completedOrders ?? 0}</strong>
            <span>已完成交易</span>
          </div>
          <div>
            <strong>{trustSummary?.activeOrders ?? 0}</strong>
            <span>进行中订单</span>
          </div>
          <div>
            <strong>{trustSummary?.waitingReviews ?? 0}</strong>
            <span>待评价</span>
          </div>
          <div>
            <strong>{trustSummary?.responseRate ?? '--'}%</strong>
            <span>消息回复率</span>
          </div>
        </div>
      </section>
    </div>
  );
}
