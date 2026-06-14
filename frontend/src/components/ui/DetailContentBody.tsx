import type { ReactNode } from 'react';

type DetailContentBodyProps = {
  title: string;
  description: ReactNode;
  meta?: ReactNode;
  expandButton?: ReactNode;
};

export function DetailContentBody({
  title,
  description,
  meta,
  expandButton
}: DetailContentBodyProps) {
  return (
    <>
      <h1 className="detail-main-title">{title}</h1>
      {meta}
      <div className="detail-description-block">
        <p>{description}</p>
        {expandButton}
      </div>
    </>
  );
}
