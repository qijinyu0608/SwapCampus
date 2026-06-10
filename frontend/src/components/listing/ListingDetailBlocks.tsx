import type { ReactNode } from 'react';
import { KeyValueGrid, StatusBadge, TagList } from '../data-display';
import type { ListingDetailBase } from '../../services/api';

type ListingStatusTone = 'default' | 'warning' | 'info' | 'success';

type ListingHeroProps = {
  detail: ListingDetailBase;
  statusTone?: ListingStatusTone;
  showStatus?: boolean;
  amountAside?: ReactNode;
  metrics?: ReactNode;
  titleAs?: 'h1' | 'h2';
  className?: string;
};

type ListingMetaPanelProps = {
  detail: ListingDetailBase;
  extraItems?: Array<{
    key: string;
    label: ReactNode;
    value: ReactNode;
  }>;
  className?: string;
};

type ListingTagPanelProps = {
  detail: ListingDetailBase;
  extraTags?: Array<{
    key: string;
    label: ReactNode;
    tone?: 'default' | 'success';
  }>;
  className?: string;
};

type ListingTimelinePanelProps = {
  detail: ListingDetailBase;
  className?: string;
};

export function ListingDetailHero({
  detail,
  statusTone = 'default',
  showStatus = true,
  amountAside,
  metrics,
  titleAs = 'h1',
  className
}: ListingHeroProps) {
  const TitleTag = titleAs;
  const classes = ['listing-detail-hero', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="listing-detail-hero-head">
        {showStatus ? (
          <StatusBadge tone={statusTone} className="listing-detail-status">
            {detail.statusLabel}
          </StatusBadge>
        ) : <span aria-hidden="true" />}
        <div className="listing-detail-amount">
          <strong>{detail.amountLabel}</strong>
          {amountAside ? <span>{amountAside}</span> : null}
        </div>
      </div>
      <TitleTag className="listing-detail-title">{detail.title}</TitleTag>
      <p className="listing-detail-description">{detail.description}</p>
      {metrics ? <div className="listing-detail-metrics">{metrics}</div> : null}
    </div>
  );
}

export function ListingDetailMetaPanel({
  detail,
  extraItems,
  className
}: ListingMetaPanelProps) {
  const classes = ['listing-detail-meta-panel', className ?? ''].filter(Boolean).join(' ');
  const items = [
    ...detail.metaItems.map((item) => ({
      key: item.key,
      label: item.label,
      value: item.value
    })),
    ...(extraItems ?? [])
  ];

  return <KeyValueGrid items={items} className={classes} emphasizeValue />;
}

export function ListingDetailTagPanel({
  detail,
  extraTags,
  className
}: ListingTagPanelProps) {
  const classes = ['listing-detail-tag-panel', className ?? ''].filter(Boolean).join(' ');
  const items = [
    ...detail.summaryTags.map((tag) => ({
      key: tag,
      label: tag
    })),
    ...(extraTags ?? [])
  ];

  return <TagList items={items} compact className={classes} />;
}

export function ListingDetailTimelinePanel({
  detail,
  className
}: ListingTimelinePanelProps) {
  const classes = ['listing-detail-timeline', className ?? ''].filter(Boolean).join(' ');

  return (
    <KeyValueGrid
      items={detail.timeline.map((item) => ({
        key: item.key,
        label: item.label,
        value: item.value
      }))}
      className={classes}
      columns={detail.timeline.length >= 4 ? 4 : undefined}
      emphasizeValue
    />
  );
}
