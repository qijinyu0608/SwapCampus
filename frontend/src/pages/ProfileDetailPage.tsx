import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Empty, Skeleton, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { KeyValueGrid } from '../components/data-display';
import { EmptyState } from '../components/feedback';
import { UserNameWithBadge } from '../components/user/UserNameWithBadge';
import { type AvatarFrameKey, UserAvatar } from '../components/user/UserAvatar';
import { useAuthState } from '../services/auth-state';
import { getRoleLabel, hasTradingAccess, isGuestUser } from '../services/session';
import { useCurrentUserProfileBundle } from '../services/user-profile';

export function ProfileDetailPage() {
  const navigate = useNavigate();
  const { currentUser: user } = useAuthState();
  const { profile, trustSummary, presentation, loading, errorMessage } = useCurrentUserProfileBundle(
    hasTradingAccess(user) ? user : null
  );

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
    { key: 'student-id', label: '学号', value: profile.studentId || '未填写' },
    { key: 'real-name', label: '真实姓名', value: profile.realName },
    { key: 'college', label: '学院', value: profile.college },
    { key: 'phone', label: '手机号', value: profile.phone },
    { key: 'identity-status', label: '实名状态', value: presentation.verificationLabel },
    { key: 'credit-level', label: '信用标签', value: presentation.creditBadge.label }
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
            <UserAvatar
              src={presentation.avatarUrl}
              alt={`${presentation.displayName}的头像`}
              fallbackLabel={presentation.initial}
              className="profile-avatar-image"
              frame={(presentation.avatarFrame as AvatarFrameKey | null) ?? undefined}
            />
          </div>
          <div>
            <UserNameWithBadge
              as="h1"
              name={presentation.displayName}
              trustedBadgeUnlocked={presentation.trustedBadgeUnlocked}
            />
            <p>{profile.email}</p>
            <div className="profile-detail-tags">
              <Tag color="gold">{presentation.verificationLabel}</Tag>
              <Tag color="green">{presentation.creditBadge.label}</Tag>
              <Tag>{getRoleLabel(profile.role)}</Tag>
            </div>
          </div>
        </div>

        <KeyValueGrid items={profileInfoItems} className="profile-detail-grid" />
      </section>
    </div>
  );
}
