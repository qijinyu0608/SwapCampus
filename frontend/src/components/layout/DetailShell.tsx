import type { ReactNode } from 'react';

type DetailShellProps = {
  className?: string;
  banner?: ReactNode;
  mainMedia?: ReactNode;
  sidePanel?: ReactNode;
  bottomContent?: ReactNode;
};

export function DetailShell({
  className,
  banner,
  mainMedia,
  sidePanel,
  bottomContent
}: DetailShellProps) {
  return (
    <div className={className ? `detail-shell ${className}` : 'detail-shell'}>
      {banner ? <section className="detail-shell-banner">{banner}</section> : null}

      <section className="detail-shell-main-card">
        <div className="detail-shell-main-layout">
          <div className="detail-shell-main-media">{mainMedia}</div>
          <aside className="detail-shell-side-panel">{sidePanel}</aside>
        </div>
      </section>

      {bottomContent ? <section className="detail-shell-bottom">{bottomContent}</section> : null}
    </div>
  );
}
