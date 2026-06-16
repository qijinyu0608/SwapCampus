import { cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CampusServicePublishPage } from './CampusServicePublishPage';

const mocks = vi.hoisted(() => ({
  params: {} as { id?: string },
  workbench: vi.fn()
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => mocks.params
  };
});

vi.mock('../components/publish', () => ({
  CampusServicePublishWorkbench: ({ listingId }: any) => {
    mocks.workbench(listingId);
    return <div>{listingId ? `workbench-${listingId}` : 'workbench-new'}</div>;
  }
}));

describe('CampusServicePublishPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.params = {};
  });

  it('renders publish mode for new campus services', () => {
    render(
      <MemoryRouter>
        <CampusServicePublishPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: '发布校园服务' })).toBeInTheDocument();
    expect(screen.getByText('workbench-new')).toBeInTheDocument();
    expect(mocks.workbench).toHaveBeenCalledWith(undefined);
  });

  it('renders edit mode when route has a listing id', () => {
    mocks.params = { id: '42' };

    render(
      <MemoryRouter>
        <CampusServicePublishPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: '编辑校园服务' })).toBeInTheDocument();
    expect(screen.getByText('workbench-42')).toBeInTheDocument();
    expect(mocks.workbench).toHaveBeenCalledWith(42);
  });
});
