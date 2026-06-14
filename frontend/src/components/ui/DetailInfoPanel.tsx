import type { ReactNode } from 'react';

type DetailInfoPanelProps = {
  className?: string;
  top?: ReactNode;
  body: ReactNode;
  footer?: ReactNode;
};

export function DetailInfoPanel({ className, top, body, footer }: DetailInfoPanelProps) {
  const classes = ['detail-info-panel', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {top ? <div className="detail-info-top">{top}</div> : null}
      <div className="detail-info-body">{body}</div>
      {footer ? <div className="detail-info-foot">{footer}</div> : null}
    </div>
  );
}
