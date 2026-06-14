import { Spin } from 'antd';

type ThinkingOverlayProps = {
  open: boolean;
  title?: string;
  description?: string;
};

export function ThinkingOverlay({
  open,
  title = 'Thinking...',
  description = '正在进行 AI 审核与 AI 分类，请稍候。'
}: ThinkingOverlayProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="thinking-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="thinking-overlay-panel">
        <Spin size="large" />
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}
