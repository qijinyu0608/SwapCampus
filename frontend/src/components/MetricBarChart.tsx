type MetricBarItem = {
  label: string;
  value: number;
  displayValue?: string;
  tone?: 'amber' | 'green' | 'blue';
};

type MetricBarChartProps = {
  items: MetricBarItem[];
  maxValue?: number;
};

export function MetricBarChart({ items, maxValue }: MetricBarChartProps) {
  const resolvedMax = maxValue ?? Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="metric-bar-chart">
      {items.map((item) => {
        const ratio = resolvedMax > 0 ? Math.max(item.value / resolvedMax, 0.08) : 0.08;
        const toneClass = item.tone ? ` ${item.tone}` : '';

        return (
          <div key={item.label} className="metric-bar-item">
            <div className="metric-bar-copy">
              <span>{item.label}</span>
              <strong>{item.displayValue ?? item.value}</strong>
            </div>
            <div className="metric-bar-track">
              <div className={`metric-bar-fill${toneClass}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
