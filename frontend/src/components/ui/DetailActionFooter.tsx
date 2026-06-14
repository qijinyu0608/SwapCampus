import type { ReactNode } from 'react';

type DetailActionFooterProps = {
  actions: ReactNode;
  status?: ReactNode;
  quietAction?: ReactNode;
};

export function DetailActionFooter({ actions, status, quietAction }: DetailActionFooterProps) {
  return (
    <>
      <div className="detail-main-actions">
        {actions}
      </div>
      {status}
      {quietAction ? (
        <div className="detail-bottom-line">
          {quietAction}
        </div>
      ) : null}
    </>
  );
}
