import { lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import vietnameseCatalog from '@astryxdesign/core/locales/vi-VN.generated.js';
import { BrowserRouter, Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useLanguage, useStrings } from './lib/i18n';
import { AuthProvider, RequireAuth } from './lib/auth';
import { AppLayout } from './components/AppLayout';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const OnboardingPage = lazy(() =>
  import('./pages/AuthPage').then((m) => ({ default: m.OnboardingPage })),
);
const ExplorePage = lazy(() =>
  import('./pages/ExplorePage').then((m) => ({ default: m.ExplorePage })),
);
const ProviderPage = lazy(() =>
  import('./pages/ProviderPage').then((m) => ({ default: m.ProviderPage })),
);
const PortfolioDetailPage = lazy(() =>
  import('./pages/PortfolioPage').then((m) => ({ default: m.PortfolioDetailPage })),
);
const ProjectsPage = lazy(() =>
  import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
);
const ProjectPage = lazy(() =>
  import('./features/projects/ProjectWorkspace').then((m) => ({ default: m.ProjectPage })),
);
const BookingsPage = lazy(() =>
  import('./pages/BookingsPage').then((m) => ({ default: m.BookingsPage })),
);
const BookingPage = lazy(() =>
  import('./pages/BookingsPage').then((m) => ({ default: m.BookingPage })),
);
const BookingCreatePage = lazy(() =>
  import('./pages/BookingRequestPage').then((m) => ({ default: m.BookingRequestPage })),
);
const BookingCompletionsPage = lazy(() =>
  import('./pages/BookingCompletionsPage').then((m) => ({ default: m.BookingCompletionsPage })),
);
const StudioPage = lazy(() =>
  import('./pages/StudioPage').then((m) => ({ default: m.StudioPage })),
);
const StudioDetailPage = lazy(() =>
  import('./pages/StudioPage').then((m) => ({ default: m.StudioDetailPage })),
);
const PortfolioPage = lazy(() =>
  import('./pages/PortfolioPage').then((m) => ({ default: m.PortfolioPage })),
);
const AccountPage = lazy(() =>
  import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const AdminPage = lazy(() =>
  import('./pages/ModerationPage').then((m) => ({ default: m.ModerationPage })),
);
const MessagesPage = lazy(() =>
  import('./pages/MessagesPage').then((m) => ({ default: m.MessagesPage })),
);
const CalendarPage = lazy(() =>
  import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })),
);
const SavedProvidersPage = lazy(() =>
  import('./pages/SavedProvidersPage').then((m) => ({ default: m.SavedProvidersPage })),
);
const PrintBriefPage = lazy(() =>
  import('./pages/PrintBriefPage').then((m) => ({ default: m.PrintBriefPage })),
);
const SandboxPage = import.meta.env.DEV
  ? lazy(() => import('./features/demo/SandboxPage').then((m) => ({ default: m.SandboxPage })))
  : null;

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function LegacyBooking() {
  const { id } = useParams();
  return <Navigate to={`/bookings/${id}`} replace />;
}
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
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Navigate to="/explore" replace />} />
                  <Route
                    path="/calendar"
                    element={
                      <RequireAuth>
                        <CalendarPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/saved"
                    element={
                      <RequireAuth>
                        <SavedProvidersPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/bookings/:id/brief"
                    element={
                      <RequireAuth>
                        <PrintBriefPage />
                      </RequireAuth>
                    }
                  />
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
                      <RequireAuth>
                        <AccountPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <RequireAuth>
                        <SettingsPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <RequireAuth>
                        <NotificationsPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/projects"
                    element={
                      <RequireAuth>
                        <ProjectsPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/projects/:id"
                    element={
                      <RequireAuth>
                        <ProjectPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/bookings"
                    element={
                      <RequireAuth>
                        <BookingsPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/bookings/new"
                    element={
                      <RequireAuth>
                        <BookingCreatePage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/bookings/:id"
                    element={
                      <RequireAuth>
                        <BookingPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/messages"
                    element={
                      <RequireAuth>
                        <MessagesPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/studio"
                    element={
                      <RequireAuth roles={['photographer']}>
                        <StudioPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/studio/:id"
                    element={
                      <RequireAuth roles={['photographer']}>
                        <StudioDetailPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/portfolio"
                    element={
                      <RequireAuth roles={['photographer']}>
                        <PortfolioPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <RequireAuth roles={['system_admin']}>
                        <AdminPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/admin/booking-completions"
                    element={
                      <RequireAuth roles={['system_admin']}>
                        <BookingCompletionsPage />
                      </RequireAuth>
                    }
                  />
                  <Route path="/bookings/live" element={<Navigate to="/bookings" replace />} />
                  <Route path="/bookings/live/:id" element={<LegacyBooking />} />
                  <Route path="/health" element={<HomePage />} />
                  {import.meta.env.DEV && SandboxPage ? (
                    <Route path="/sandbox" element={<SandboxPage />} />
                  ) : null}
                  <Route
                    path="*"
                    element={
                      <section className="empty-state">
                        <h1>{strings.notFound}</h1>
                        <Link to="/">{strings.home}</Link>
                      </section>
                    }
                  />
                </Route>
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </Theme>
      </InternationalizationProvider>
    </QueryClientProvider>
  );
}
