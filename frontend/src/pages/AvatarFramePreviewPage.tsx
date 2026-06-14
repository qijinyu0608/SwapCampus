import { AVATAR_OPTIONS } from '../constants/avatarOptions';
import { AVATAR_FRAMES, type AvatarFrameKey, UserAvatar } from '../components/user/UserAvatar';

const previewUsers = [
  {
    id: 1,
    name: '林栖',
    college: '信息工程学院',
    credit: '信用优秀',
    avatarUrl: AVATAR_OPTIONS[1]?.src ?? AVATAR_OPTIONS[0]?.src ?? ''
  },
  {
    id: 2,
    name: '许澄',
    college: '经济管理学院',
    credit: '信用良好',
    avatarUrl: AVATAR_OPTIONS[2]?.src ?? AVATAR_OPTIONS[0]?.src ?? ''
  },
  {
    id: 3,
    name: '周言',
    college: '外国语学院',
    credit: '信用稳定',
    avatarUrl: AVATAR_OPTIONS[3]?.src ?? AVATAR_OPTIONS[0]?.src ?? ''
  }
] as const;

const sizePreview: Array<{ key: string; label: string; className: string }> = [
  { key: 'hero', label: '资料页主头像', className: 'is-hero' },
  { key: 'card', label: '公开主页/详情卡片', className: 'is-card' },
  { key: 'list', label: '消息/列表头像', className: 'is-list' }
];

export function AvatarFramePreviewPage() {
  const heroUser = previewUsers[0];

  return (
    <div className="page-grid avatar-frame-preview-page">
      <section className="avatar-frame-preview-shell">
        <header className="avatar-frame-preview-head">
          <div>
            <h1>头像框预览</h1>
            <p>先独立展示组件效果，不接入积分兑换与前端业务流。</p>
          </div>
        </header>

        <section className="avatar-frame-preview-section">
          <div className="avatar-frame-preview-section-head">
            <strong>资料页主头像</strong>
            <span>模拟资料页与公开主页的大头像效果</span>
          </div>
          <div className="avatar-frame-hero-grid">
            {AVATAR_FRAMES.map((frame) => (
              <article key={frame.key} className="avatar-frame-hero-card">
                <div className="avatar-frame-hero-surface">
                  <div className="profile-avatar-badge avatar-frame-preview-hero-avatar">
                    <UserAvatar
                      src={heroUser.avatarUrl}
                      alt={`${heroUser.name}的头像`}
                      fallbackLabel={heroUser.name.slice(0, 1)}
                      className="profile-avatar-image"
                      frame={frame.key}
                    />
                  </div>
                  <div className="avatar-frame-hero-copy">
                    <strong>{heroUser.name}</strong>
                    <span>{heroUser.college}</span>
                  </div>
                </div>
                <div className="avatar-frame-chip-row">
                  <span className={`avatar-frame-chip ${frame.className}`}>{frame.label}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="avatar-frame-preview-section">
          <div className="avatar-frame-preview-section-head">
            <strong>多尺寸兼容</strong>
            <span>看同一套头像框在不同尺寸容器下是否稳定</span>
          </div>
          <div className="avatar-frame-size-grid">
            {AVATAR_FRAMES.map((frame) => (
              <article key={`size-${frame.key}`} className="avatar-frame-size-card">
                <div className="avatar-frame-size-card-head">
                  <strong>{frame.label}</strong>
                </div>
                <div className="avatar-frame-size-row">
                  {sizePreview.map((size) => (
                    <div key={size.key} className="avatar-frame-size-cell">
                      <div className={`avatar-frame-size-avatar ${size.className}`}>
                        <UserAvatar
                          src={heroUser.avatarUrl}
                          alt=""
                          fallbackLabel={heroUser.name.slice(0, 1)}
                          frame={frame.key}
                        />
                      </div>
                      <span>{size.label}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="avatar-frame-preview-section">
          <div className="avatar-frame-preview-section-head">
            <strong>列表与关系场景</strong>
            <span>模拟关注列表、消息会话、公开主页访客列表</span>
          </div>
          <div className="avatar-frame-scene-grid">
            {AVATAR_FRAMES.map((frame) => (
              <article key={`scene-${frame.key}`} className="avatar-frame-scene-card">
                <div className="avatar-frame-scene-card-head">
                  <strong>{frame.label}</strong>
                </div>
                <div className="avatar-frame-scene-list">
                  {previewUsers.map((user, index) => (
                    <div key={`${frame.key}-${user.id}`} className="avatar-frame-scene-item">
                      <div className="avatar-frame-scene-avatar">
                        <UserAvatar
                          src={user.avatarUrl}
                          alt={`${user.name}的头像`}
                          fallbackLabel={user.name.slice(0, 1)}
                          frame={frame.key as AvatarFrameKey}
                        />
                      </div>
                      <div className="avatar-frame-scene-copy">
                        <strong>{user.name}</strong>
                        <span>{index === 0 ? '资料页主视觉' : index === 1 ? '公开主页卡片' : '消息列表头像'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
