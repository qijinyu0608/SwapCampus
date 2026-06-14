type UserNameWithBadgeProps = {
  name: string;
  trustedBadgeUnlocked?: boolean;
  as?: 'span' | 'strong' | 'h1';
  className?: string;
};

export function UserNameWithBadge({
  name,
  trustedBadgeUnlocked = false,
  as = 'span',
  className
}: UserNameWithBadgeProps) {
  const TagName = as;
  const classes = ['user-name-with-badge', className ?? ''].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      <TagName>{name}</TagName>
      {trustedBadgeUnlocked ? (
        <span className="user-inline-trusted-badge" aria-label="守约徽章" title="守约徽章">
          <span className="user-inline-trusted-badge-medal">
            <span className="user-inline-trusted-badge-core" />
            <span className="user-inline-trusted-badge-ribbon left" />
            <span className="user-inline-trusted-badge-ribbon right" />
            <span className="user-inline-trusted-badge-check" />
          </span>
        </span>
      ) : null}
    </span>
  );
}
