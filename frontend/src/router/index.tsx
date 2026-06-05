import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout';
import { appRoutes } from './route-config';

export function AppRouter() {
  return (
    <AppShell>
      <Routes>
        {appRoutes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
      </Routes>
    </AppShell>
  );
}
