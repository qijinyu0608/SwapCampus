import type { ReactNode } from 'react';
import { Modal } from 'antd';

type FormActionModalProps = {
  title: string;
  open: boolean;
  loading?: boolean;
  width?: number;
  className?: string;
  okText?: string;
  cancelText?: string;
  onCancel: () => void;
  onSubmit: () => void;
  children: ReactNode;
};

export function FormActionModal({
  title,
  open,
  loading = false,
  width,
  className,
  okText = '确认',
  cancelText = '取消',
  onCancel,
  onSubmit,
  children
}: FormActionModalProps) {
  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={loading}
      okText={okText}
      cancelText={cancelText}
      width={width}
      className={className}
    >
      {children}
    </Modal>
  );
}
