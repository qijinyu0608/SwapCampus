import { Layout } from 'antd';
import { useAuthState } from '../../services/auth-state';
import { TopBar } from './TopBar';

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const { currentUser } = useAuthState();

  return (
    <Layout className="app-shell">
      <Layout.Header className="app-header">
        <div className="app-header-inner">
          <TopBar currentUser={currentUser} />
        </div>
      </Layout.Header>
      <Layout.Content className="app-content">
        {children}
      </Layout.Content>
    </Layout>
  );
}
