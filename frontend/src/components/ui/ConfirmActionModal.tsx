import type { ReactNode } from 'react';
import { Input, Modal } from 'antd';

type ConfirmActionModalProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmActionModal({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '返回',
  danger = false,
  loading = false,
  onConfirm,
  onCancel
}: ConfirmActionModalProps) {
  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={onConfirm}
      okButtonProps={{ danger, loading }}
      okText={confirmText}
      cancelText={cancelText}
    >
      {typeof description === 'string' ? <p>{description}</p> : description}
    </Modal>
  );
}

type ConfirmReasonModalProps = Omit<ConfirmActionModalProps, 'description'> & {
  reason: string;
  reasonPlaceholder?: string;
  onReasonChange: (value: string) => void;
  rows?: number;
};

export function ConfirmReasonModal({
  reason,
  reasonPlaceholder,
  onReasonChange,
  rows = 4,
  ...props
}: ConfirmReasonModalProps) {
  return (
    <ConfirmActionModal
      {...props}
      description={(
        <Input.TextArea
          rows={rows}
          value={reason}
          placeholder={reasonPlaceholder}
          onChange={(event) => onReasonChange(event.target.value)}
        />
      )}
    />
  );
}
