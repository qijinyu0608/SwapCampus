import type { PropsWithChildren } from 'react';
import { SectionCard } from '../ui/SectionCard';

export function PageCard({ title, children }: PropsWithChildren<{ title?: string }>) {
  return (
    <SectionCard title={title} className="soft-card">
      {children}
    </SectionCard>
  );
}
