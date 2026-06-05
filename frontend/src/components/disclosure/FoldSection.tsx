import type { PropsWithChildren } from 'react';

type FoldSectionProps = PropsWithChildren<{
  title: string;
  meta?: string;
  defaultOpen?: boolean;
  compact?: boolean;
}>;

export function FoldSection({ title, meta, defaultOpen = false, compact = false, children }: FoldSectionProps) {
  return (
    <details className={compact ? 'fold-section compact' : 'fold-section'} open={defaultOpen}>
      <summary className="fold-section-summary">
        <strong>{title}</strong>
        {meta ? <span>{meta}</span> : null}
      </summary>
      <div className="fold-section-body">{children}</div>
    </details>
  );
}
