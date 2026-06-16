import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CreditBadgePreviewPage } from './CreditBadgePreviewPage';

describe('CreditBadgePreviewPage', () => {
  it('renders score rows and badge previews', () => {
    const { container } = render(<CreditBadgePreviewPage />);

    expect(screen.getByRole('heading', { name: '信用标签预览' })).toBeInTheDocument();
    expect(screen.getByText('信用分')).toBeInTheDocument();
    expect(screen.getByText('标签文案')).toBeInTheDocument();
    expect(screen.getByText('A 叠加版')).toBeInTheDocument();
    expect(screen.getByText('B 更奢侈品')).toBeInTheDocument();

    ['95', '85', '75', '65', '50'].forEach((score) => {
      expect(screen.getByText(score)).toBeInTheDocument();
    });

    expect(screen.getAllByText('信用优秀').length).toBeGreaterThan(0);
    expect(screen.getAllByText('信用稳定').length).toBeGreaterThan(0);
    expect(screen.getAllByText('信用正常').length).toBeGreaterThan(0);
    expect(screen.getAllByText('信用待提升').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.credit-badge-preview-row').length).toBe(6);
  });
});
