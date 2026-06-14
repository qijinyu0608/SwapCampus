import { DEFAULT_AVATAR_URL } from '../../constants/avatarOptions';
import { useEffect, useState } from 'react';

export type AvatarFrameKey = 'none' | 'blue-glow' | 'aurora' | 'gold-ring' | 'rose-rim' | 'mint-shine';

export type AvatarFrameConfig = {
  key: AvatarFrameKey;
  label: string;
  className: string;
};

export const AVATAR_FRAMES: AvatarFrameConfig[] = [
  { key: 'blue-glow', label: '蓝曜', className: 'is-blue-glow' },
  { key: 'aurora', label: '极光', className: 'is-aurora' },
  { key: 'gold-ring', label: '鎏金', className: 'is-gold-ring' },
  { key: 'rose-rim', label: '绯光', className: 'is-rose-rim' },
  { key: 'mint-shine', label: '青岚', className: 'is-mint-shine' }
];

type UserAvatarProps = {
  src?: string | null;
  alt?: string;
  fallbackLabel?: string | null;
  className?: string;
  frame?: AvatarFrameKey | null;
};

export function UserAvatar({
  src,
  alt = '用户头像',
  fallbackLabel = '校',
  className,
  frame = 'none'
}: UserAvatarProps) {
  const imageSrc = src?.trim() || DEFAULT_AVATAR_URL;
  const [showFallback, setShowFallback] = useState(false);
  const classes = [
    'user-avatar',
    frame && frame !== 'none' ? 'has-avatar-frame' : '',
    frame && frame !== 'none' ? `avatar-frame-${frame}` : '',
    className ?? ''
  ].filter(Boolean).join(' ');
  const fallbackInitial = fallbackLabel == null ? '校' : fallbackLabel.slice(0, 1);

  useEffect(() => {
    setShowFallback(false);
  }, [imageSrc]);

  return (
    <span className={classes}>
      <span className="user-avatar-frame-shell" aria-hidden={frame === 'none' ? undefined : 'true'}>
        {frame && frame !== 'none' ? <span className="user-avatar-frame" aria-hidden="true" /> : null}
        <span className="user-avatar-inner">
          {!showFallback ? (
            <img
              src={imageSrc}
              alt={alt}
              onError={(event) => {
                const target = event.currentTarget;
                if (target.src.endsWith(DEFAULT_AVATAR_URL)) {
                  setShowFallback(true);
                  return;
                }
                target.src = DEFAULT_AVATAR_URL;
              }}
            />
          ) : null}
          {showFallback ? <span className="user-avatar-fallback" aria-hidden="true">{fallbackInitial}</span> : null}
        </span>
      </span>
    </span>
  );
}
