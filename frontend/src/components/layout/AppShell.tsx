import { Layout } from 'antd';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getDemoUser, subscribeSessionChange } from '../../services/session';
import { TopBar } from './TopBar';

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(getDemoUser());

  useEffect(() => subscribeSessionChange(() => setCurrentUser(getDemoUser())), []);

  return (
    <Layout className="app-shell">
      <Layout.Header className="app-header">
        <div className="app-header-inner">
          <TopBar currentUser={currentUser} />
        </div>
      </Layout.Header>
      <Layout.Content className={location.pathname === '/messages' ? 'app-content messages-app-content' : 'app-content'}>
        {children}
      </Layout.Content>
    </Layout>
  );
}
