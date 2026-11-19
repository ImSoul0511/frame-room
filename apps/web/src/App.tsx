import { lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import vietnameseCatalog from '@astryxdesign/core/locales/vi-VN.generated.js';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { useLanguage, useStrings } from './lib/i18n';
import { AuthProvider } from './lib/auth';
import { AppLayout } from './components/AppLayout';
import { DemoProvider, DemoGate } from './features/demo/DemoContext';

const HomePage = lazy(() =>
  import('./pages/HomePage').then((page) => ({ default: page.HomePage })),
);
const AuthPage = lazy(() =>
  import('./pages/AuthPage').then((page) => ({ default: page.AuthPage })),
);
const OnboardingPage = lazy(() =>
  import('./pages/AuthPage').then((page) => ({ default: page.OnboardingPage })),
);
const ExplorePage = lazy(() =>
  import('./pages/ExplorePage').then((page) => ({ default: page.ExplorePage })),
);
const ProviderPage = lazy(() =>
  import('./pages/ProviderPage').then((page) => ({ default: page.ProviderPage })),
);
const PortfolioDetailPage = lazy(() =>
  import('./features/demo/PublicPortfolioPage').then((page) => ({
    default: page.PublicPortfolioPage,
  })),
);
const ProjectsPage = lazy(() =>
  import('./features/demo/ProjectsPage').then((page) => ({ default: page.WorkspaceProjectsPage })),
);
const ProjectPage = lazy(() =>
  import('./features/demo/ProjectsPage').then((page) => ({ default: page.WorkspaceProjectPage })),
);
const BookingsPage = lazy(() =>
  import('./features/demo/BookingsPages').then((page) => ({ default: page.WorkspaceBookingsPage })),
);
const BookingPage = lazy(() =>
  import('./features/demo/BookingsPages').then((page) => ({ default: page.WorkspaceBookingPage })),
);
const BookingCreatePage = lazy(() =>
  import('./features/demo/BookingsPages').then((page) => ({
    default: page.WorkspaceBookingCreatePage,
  })),
);
const StudioPage = lazy(() =>
  import('./features/demo/StudioPage').then((page) => ({ default: page.WorkspaceStudioPage })),
);
const PortfolioPage = lazy(() =>
  import('./features/demo/CatalogPage').then((page) => ({ default: page.WorkspaceCatalogPage })),
);
const AccountPage = lazy(() =>
  import('./features/demo/AccountPages').then((page) => ({ default: page.WorkspaceAccountPage })),
);
const NotificationsPage = lazy(() =>
  import('./features/demo/AccountPages').then((page) => ({
    default: page.WorkspaceNotificationsPage,
  })),
);
const AdminPage = lazy(() =>
  import('./features/demo/ModerationPage').then((page) => ({
    default: page.WorkspaceModerationPage,
  })),
);
const MessagesPage = lazy(() =>
  import('./features/demo/Conversations').then((page) => ({ default: page.WorkspaceMessagesPage })),
);

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const professionals = ['photographer', 'photographer2', 'manager'] as const;
const participants = ['client', ...professionals] as const;
export function App() {
  const strings = useStrings();
  const { language } = useLanguage();
  return (
    <QueryClientProvider client={queryClient}>
      <InternationalizationProvider
        locale={language === 'vi' ? 'vi-VN' : 'en'}
        messages={{ 'vi-VN': vietnameseCatalog }}
      >
        <Theme theme={neutralTheme} mode="light">
          <BrowserRouter>
            <AuthProvider>
              <DemoProvider>
                <Routes>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Navigate to="/explore" replace />} />
                    <Route path="/explore" element={<ExplorePage />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/auth/callback" element={<AuthPage callback />} />
                    <Route path="/reset-password" element={<AuthPage recovery />} />
                    <Route path="/onboarding" element={<OnboardingPage />} />
                    <Route path="/providers/:type/:id" element={<ProviderPage />} />
                    <Route path="/portfolios/:id" element={<PortfolioDetailPage />} />
                    <Route
                      path="/profile"
                      element={
                        <DemoGate>
                          <AccountPage />
                        </DemoGate>
                      }
                    />
                    <Route
                      path="/settings"
                      element={
                        <DemoGate>
                          <AccountPage editing />
                        </DemoGate>
                      }
                    />
                    <Route
                      path="/notifications"
                      element={
                        <DemoGate>
                          <NotificationsPage />
                        </DemoGate>
                      }
                    />
                    <Route
                      path="/projects"
                      element={
                        <DemoGate roles={['client']}>
                          <ProjectsPage />
                        </DemoGate>
                      }
                    />
                    <Route
                      path="/projects/:id"
                      element={
                        <DemoGate roles={['client']}>
                          <ProjectPage />
                        </DemoGate>
                      }
                    />
                    <Route
                      path="/bookings"
                      element={
                        <DemoGate roles={participants}>
                          <BookingsPage />
                        </DemoGate>
                      }
                    />
                    <Route
                      path="/bookings/new"
                      element={
                        <DemoGate roles={['client']}>
                          <BookingCreatePage />
                        </DemoGate>
                      }
                    />
                    <Route
                      path="/bookings/:id"
                      element={
                        <DemoGate roles={participants}>
                          <BookingPage />
                        </DemoGate>
                      }
                    />
                    <Route
                      path="/messages"
                      element={
                        <DemoGate roles={participants}>
                          <MessagesPage />
                        </DemoGate>
                      }
                    />
                    <Route
                      path="/studio"
                      element={
                        <DemoGate roles={professionals}>
                          <StudioPage />
                        </DemoGate>
                      }
                    />
                    <Route
                      path="/studio/:id"
                      element={
                        <DemoGate roles={professionals}>
                          <StudioPage />
                        </DemoGate>
                      }
                    />
                    <Route
                      path="/portfolio"
                      element={
                        <DemoGate roles={professionals}>
                          <PortfolioPage />
                        </DemoGate>
                      }
                    />
                    <Route
                      path="/admin"
                      element={
                        <DemoGate roles={['admin']}>
                          <AdminPage />
                        </DemoGate>
                      }
                    />
                    <Route path="/health" element={<HomePage />} />
                    <Route
                      path="*"
                      element={
                        <main>
                          <h1>{strings.notFound}</h1>
                          <Link to="/">{strings.home}</Link>
                        </main>
                      }
                    />
                  </Route>
                </Routes>
              </DemoProvider>
            </AuthProvider>
          </BrowserRouter>
        </Theme>
      </InternationalizationProvider>
    </QueryClientProvider>
  );
}
