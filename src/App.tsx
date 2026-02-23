import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RouterProvider, useRouter } from './context/RouterContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeadImportPage } from './pages/LeadImportPage';
import { ContactsPage } from './pages/ContactsPage';
import { ContactDetailPage } from './pages/ContactDetailPage';
import { PipelinePage } from './pages/PipelinePage';
import { BuyersPage } from './pages/BuyersPage';
import { ActivityLogPage } from './pages/ActivityLogPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';

function AppRoutes() {
  const { user, loading, isAdmin } = useAuth();
  const { route, navigate } = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user && route.page !== 'login') {
      navigate('login');
    } else if (user && route.page === 'login') {
      navigate('dashboard');
    }
  }, [user, loading, route.page, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1E6FA4] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || route.page === 'login') return <LoginPage />;

  if (route.page === 'settings' && !isAdmin) {
    navigate('dashboard');
    return null;
  }

  switch (route.page) {
    case 'dashboard':
      return <DashboardPage />;
    case 'lead-import':
      return <LeadImportPage />;
    case 'contacts':
      return <ContactsPage />;
    case 'contact-detail':
      return <ContactDetailPage />;
    case 'pipeline':
      return <PipelinePage />;
    case 'buyers':
      return <BuyersPage />;
    case 'activity-log':
      return <ActivityLogPage />;
    case 'notifications':
      return <NotificationsPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <DashboardPage />;
  }
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider>
          <AppRoutes />
        </RouterProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
