import { getUserCreditBadge, type UserCreditBadgeTone } from '../utils/userPresentation';

const previewScores = [95, 85, 75, 65, 50];

type PreviewItem = {
  score: number;
  tone: UserCreditBadgeTone;
  label: string;
};

const previewItems: PreviewItem[] = previewScores.map((score) => {
  const badge = getUserCreditBadge(score);
  return {
    score,
    tone: badge.tone,
    label: badge.label
  };
});

export function CreditBadgePreviewPage() {
  return (
    <div className="page-grid credit-badge-preview-page">
      <section className="credit-badge-preview-shell">
        <header className="credit-badge-preview-head">
          <h1>信用标签预览</h1>
        </header>

        <div className="credit-badge-preview-table">
          <div className="credit-badge-preview-row is-head">
            <span>信用分</span>
            <span>标签文案</span>
            <span>A 更珠宝</span>
            <span>B 更奢侈品</span>
          </div>

          {previewItems.map((item) => (
            <div key={item.score} className="credit-badge-preview-row">
              <strong>{item.score}</strong>
              <span>{item.label}</span>
              <div className="credit-badge-preview-badge-cell">
                <div className={`ui-credit-badge-preview-a is-${item.tone}`}>
                  {item.label}
                </div>
              </div>
              <div className="credit-badge-preview-badge-cell">
                <div className={`ui-credit-badge-preview-b is-${item.tone}`}>
                  {item.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
