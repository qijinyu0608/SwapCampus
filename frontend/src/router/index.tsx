import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { AdminPage } from '../pages/AdminPage';
import { CampusServicesPage } from '../pages/CampusServicesPage';
import { FavoritesPage } from '../pages/FavoritesPage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { MessagesPage } from '../pages/MessagesPage';
import { ProductDetailPage } from '../pages/ProductDetailPage';
import { ProductPublishPage } from '../pages/ProductPublishPage';
import { ProfileDetailPage } from '../pages/ProfileDetailPage';
import { ProfilePage } from '../pages/ProfilePage';
import { PublicUserPage } from '../pages/PublicUserPage';

export function AppRouter() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/campus-services" element={<CampusServicesPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/users/:id" element={<PublicUserPage />} />
        <Route path="/publish" element={<ProductPublishPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/detail" element={<ProfileDetailPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </AppShell>
  );
}
