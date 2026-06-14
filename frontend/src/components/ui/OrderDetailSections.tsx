import type { ReactNode } from 'react';
import { Descriptions, Tag } from 'antd';
import { SectionCard } from './SectionCard';
import { UserNameWithBadge } from '../user/UserNameWithBadge';

type DetailHeroProps = {
  title: string;
  statusLabel: string;
  statusColor: string;
  codeLabel: string;
  codeValue: string | number;
  counterpartName: string;
  counterpartTrusted?: boolean;
  amountLabel: string;
  imageSrc: string;
  imageAlt: string;
};

export function OrderDetailHeroSection({
  title,
  statusLabel,
  statusColor,
  codeLabel,
  codeValue,
  counterpartName,
  counterpartTrusted = false,
  amountLabel,
  imageSrc,
  imageAlt
}: DetailHeroProps) {
  return (
    <SectionCard className="order-detail-hero-card">
      <div className="order-detail-hero">
        <div className="order-detail-hero-copy">
          <div className="order-detail-hero-top">
            <strong>{title}</strong>
            <Tag color={statusColor}>{statusLabel}</Tag>
          </div>
          <span>{`${codeLabel}：${codeValue}`}</span>
          <span>
            对方：
            <UserNameWithBadge
              name={counterpartName}
              trustedBadgeUnlocked={counterpartTrusted}
            />
          </span>
          <b>{amountLabel}</b>
        </div>
        <img src={imageSrc} alt={imageAlt} className="order-detail-hero-image" />
      </div>
    </SectionCard>
  );
}

type DetailToolbarProps = {
  children: ReactNode;
  extra?: ReactNode;
};

export function OrderDetailToolbarSection({ children, extra }: DetailToolbarProps) {
  return (
    <SectionCard className="order-detail-panel">
      <div className="order-detail-toolbar">{children}</div>
      {extra}
    </SectionCard>
  );
}

type DetailDescriptionsProps = {
  title: string;
  items: Array<{
    key: string;
    label: string;
    value: ReactNode;
  }>;
};

export function OrderDetailDescriptionsSection({ title, items }: DetailDescriptionsProps) {
  return (
    <SectionCard className="order-detail-panel">
      <Descriptions title={title} column={1} size="small">
        {items.map((item) => (
          <Descriptions.Item key={item.key} label={item.label}>{item.value}</Descriptions.Item>
        ))}
      </Descriptions>
    </SectionCard>
  );
}

type SnapshotEntryProps = {
  title: string;
  subtitle: string;
  meta: string;
  onClick: () => void;
};

export function OrderDetailEntrySection({ title, subtitle, meta, onClick }: SnapshotEntryProps) {
  return (
    <SectionCard className="order-detail-panel">
      <button type="button" className="order-snapshot-entry" onClick={onClick}>
        <div className="order-snapshot-entry-copy">
          <strong>{title}</strong>
          <span>{subtitle}</span>
          <small>{meta}</small>
        </div>
        <span className="order-snapshot-entry-arrow" aria-hidden="true">查看详情</span>
      </button>
    </SectionCard>
  );
}
