import { DEFAULT_AVATAR_URL } from '../../constants/avatarOptions';
import { useEffect, useState } from 'react';

type UserAvatarProps = {
  src?: string | null;
  alt?: string;
  fallbackLabel?: string | null;
  className?: string;
};

export function UserAvatar({ src, alt = '用户头像', fallbackLabel = '校', className }: UserAvatarProps) {
  const [showFallback, setShowFallback] = useState(false);
  const classes = ['user-avatar', className ?? ''].filter(Boolean).join(' ');
  const imageSrc = src?.trim() || DEFAULT_AVATAR_URL;
  const fallbackInitial = fallbackLabel == null ? '校' : fallbackLabel.slice(0, 1);

  useEffect(() => {
    setShowFallback(false);
  }, [imageSrc]);

  return (
    <span className={classes}>
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
  );
}
