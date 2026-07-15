import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ProductProvider } from './lib/ProductContext';
import { LoginPage } from './pages/LoginPage';
import { AccessGate } from './pages/AccessGate';
import { AppLayout } from './pages/AppLayout';
import { DashboardHome } from './pages/DashboardHome';
import { ResourcePage } from './pages/ResourcePage';
import { ScreensPage } from './pages/ScreensPage';
import { HelpPage } from './pages/HelpPage';
import { Spinner } from './components/Spinner';

function Gate() {
  const { session, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spinner label="Loading..." />
      </div>
    );
  }

  if (!session) return <LoginPage />;
  if (!isAdmin) return <AccessGate />;

  return (
    <ProductProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="screens" element={<ScreensPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="r/:key" element={<ResourcePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ProductProvider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}
