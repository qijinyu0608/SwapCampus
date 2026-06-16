import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createRoot: vi.fn(),
  renderRoot: vi.fn(),
  initAuth: vi.fn()
}));

describe('main entry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="root"></div>';
    mocks.createRoot.mockReturnValue({
      render: mocks.renderRoot
    });
  });

  it('initializes auth and renders the application tree', async () => {
    vi.doMock('react-dom/client', () => ({
      default: {
        createRoot: mocks.createRoot
      },
      createRoot: mocks.createRoot
    }));

    vi.doMock('antd', () => ({
      ConfigProvider: ({ theme, children }: any) => (
        <div data-testid="config-provider" data-theme={JSON.stringify(theme)}>
          {children}
        </div>
      )
    }));

    vi.doMock('react-router-dom', () => ({
      BrowserRouter: ({ children }: any) => <div data-testid="browser-router">{children}</div>
    }));

    vi.doMock('./router', () => ({
      AppRouter: () => <div data-testid="app-router">router</div>
    }));

    vi.doMock('./services/auth-state', () => ({
      AuthStateProvider: ({ children }: any) => <div data-testid="auth-provider">{children}</div>
    }));

    vi.doMock('./services/auth', () => ({
      initAuth: mocks.initAuth
    }));

    const { antdTheme } = await import('./theme/tokens');

    await import('./main');

    expect(mocks.initAuth).toHaveBeenCalledTimes(1);
    expect(mocks.createRoot).toHaveBeenCalledWith(document.getElementById('root'));
    expect(mocks.renderRoot).toHaveBeenCalledTimes(1);

    const renderedTree = mocks.renderRoot.mock.calls[0]?.[0];
    render(renderedTree);

    expect(screen.getByTestId('config-provider')).toHaveAttribute('data-theme', JSON.stringify(antdTheme));
    expect(screen.getByTestId('browser-router')).toBeInTheDocument();
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
    expect(screen.getByTestId('app-router')).toBeInTheDocument();
    expect(screen.getByText('router')).toBeInTheDocument();
  });
});
