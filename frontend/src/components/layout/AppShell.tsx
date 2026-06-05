import { Layout } from 'antd';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { navigationItems } from '../../router/route-config';
import { clearDemoUser, getDemoUser, hasAdminAccess, isGuestUser, subscribeSessionChange } from '../../services/session';

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getDemoUser());

  const adminMode = hasAdminAccess(currentUser);
  const guestMode = isGuestUser(currentUser);
  const accountLinkLabel = currentUser ? currentUser.name : '登录';
  const actionLink = adminMode
    ? { to: '/admin', label: '后台' }
    : { to: '/publish', label: guestMode ? '去登录' : '发布' };

  function handleLogout() {
    clearDemoUser();
    void navigate('/');
  }

  useEffect(() => subscribeSessionChange(() => setCurrentUser(getDemoUser())), []);

  return (
    <Layout className="app-shell">
      <Layout.Header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="brand-block">
            <div className="brand-title">SwapCampus</div>
            <div className="brand-subtitle">同校闲置</div>
          </Link>
          <nav className="nav-pills">
            {navigationItems.map((item) => (
              <Link
                key={item.key}
                to={item.key}
                className={location.pathname === item.key ? 'nav-pill active' : 'nav-pill'}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <div className="header-account-block">
              <Link to={currentUser ? '/profile' : '/login'} className="header-quiet-link">
                {accountLinkLabel}
              </Link>
              {currentUser ? (
                <div className="header-account-actions">
                  <button type="button" className="header-quiet-button" onClick={handleLogout}>
                    退出登录
                  </button>
                </div>
              ) : null}
            </div>
            <Link to={actionLink.to} className="header-sell-button">
              {actionLink.label}
            </Link>
          </div>
        </div>
      </Layout.Header>
      <Layout.Content className={location.pathname === '/messages' ? 'app-content messages-app-content' : 'app-content'}>
        {children}
      </Layout.Content>
    </Layout>
  );
}
