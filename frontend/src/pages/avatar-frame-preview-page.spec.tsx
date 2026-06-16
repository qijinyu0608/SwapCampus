import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AVATAR_FRAMES } from '../components/user/UserAvatar';
import { AvatarFramePreviewPage } from './AvatarFramePreviewPage';

describe('AvatarFramePreviewPage', () => {
  it('renders frame previews across hero, size and list scenes', () => {
    const { container } = render(<AvatarFramePreviewPage />);

    expect(screen.getByRole('heading', { name: '头像框预览' })).toBeInTheDocument();
    expect(screen.getByText('多尺寸兼容')).toBeInTheDocument();
    expect(screen.getByText('列表与关系场景')).toBeInTheDocument();
    expect(screen.getAllByText('林栖').length).toBeGreaterThan(0);
    expect(screen.getAllByText('许澄').length).toBeGreaterThan(0);
    expect(screen.getAllByText('周言').length).toBeGreaterThan(0);

    AVATAR_FRAMES.forEach((frame) => {
      expect(screen.getAllByText(frame.label).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByAltText('林栖的头像').length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('许澄的头像').length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('周言的头像').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.avatar-frame-hero-card').length).toBe(AVATAR_FRAMES.length);
    expect(container.querySelectorAll('.avatar-frame-size-card').length).toBe(AVATAR_FRAMES.length);
    expect(container.querySelectorAll('.avatar-frame-scene-card').length).toBe(AVATAR_FRAMES.length);
  });
});
