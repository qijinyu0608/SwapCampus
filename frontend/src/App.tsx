import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';
import { AuthStateProvider } from './services/auth-state';

export function App() {
  return (
    <BrowserRouter>
      <AuthStateProvider>
        <AppRouter />
      </AuthStateProvider>
    </BrowserRouter>
  );
}
