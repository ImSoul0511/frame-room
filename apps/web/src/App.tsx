import { lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import vietnameseCatalog from '@astryxdesign/core/locales/vi-VN.generated.js';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useLanguage, useStrings } from './lib/i18n';
import { AuthProvider, RequireAuth } from './lib/auth';
import { AppLayout } from './components/AppLayout';
import { ProfileLayout } from './components/ProfileLayout';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const OnboardingPage = lazy(() =>
  import('./pages/AuthPage').then((m) => ({ default: m.OnboardingPage })),
);
const ExplorePage = lazy(() =>
  import('./pages/ExplorePage').then((m) => ({ default: m.ExplorePage })),
);
const GenrePage = lazy(() => import('./pages/GenrePage').then((m) => ({ default: m.GenrePage })));
const ProviderDirectoryPage = lazy(() =>
  import('./pages/ProviderDirectoryPage').then((m) => ({ default: m.ProviderDirectoryPage })),
);
const DiscoverySearchPage = lazy(() =>
  import('./pages/DiscoverySearchPage').then((m) => ({ default: m.DiscoverySearchPage })),
);
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const GuidePage = lazy(() => import('./pages/GuidePage').then((m) => ({ default: m.GuidePage })));
function GenreIndexRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/home', search, hash: '#genres' }} replace />;
}
function ExploreRoute() {
  const { hash } = useLocation();
  return hash === '#genres' ? <GenreIndexRedirect /> : <DiscoverySearchPage />;
}
function PhotographerDirectoryRoute() {
  const { search } = useLocation();
  return new URLSearchParams(search).has('mode') ? (
    <RedirectWithQuery to="/explore" />
  ) : (
    <ProviderDirectoryPage key="photographers" type="photographer" />
  );
}
function RedirectWithQuery({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: to, search, hash }} replace />;
}
const ProviderPage = lazy(() =>
  import('./pages/ProviderPage').then((m) => ({ default: m.ProviderPage })),
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
const StudioPage = lazy(() =>
  import('./pages/StudioPage').then((m) => ({ default: m.StudioPage })),
);
const StudioDetailPage = lazy(() =>
  import('./pages/StudioPage').then((m) => ({ default: m.StudioDetailPage })),
);
const PortfolioPage = lazy(() =>
  import('./pages/PortfolioPage').then((m) => ({ default: m.PortfolioPage })),
);
const PortfolioCreatePage = lazy(() =>
  import('./pages/PortfolioCreatePage').then((m) => ({ default: m.PortfolioCreatePage })),
);
const ServiceEditPage = lazy(() =>
  import('./pages/ServiceEditPage').then((m) => ({ default: m.ServiceEditPage })),
);
const PortfolioDetailPage = lazy(() =>
  import('./pages/PortfolioPage').then((m) => ({ default: m.PortfolioDetailPage })),
);
const ProjectsPage = lazy(() =>
  import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
);
const ProjectPage = lazy(() =>
  import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectPage })),
);
const BookingsPage = lazy(() =>
  import('./pages/BookingsPage').then((m) => ({ default: m.BookingsPage })),
);
const BookingPage = lazy(() =>
  import('./pages/BookingsPage').then((m) => ({ default: m.BookingPage })),
);
const BookingRequestPage = lazy(() =>
  import('./pages/BookingRequestPage').then((m) => ({ default: m.BookingRequestPage })),
);
const MessagesPage = lazy(() =>
  import('./pages/MessagesPage').then((m) => ({ default: m.MessagesPage })),
);
const ModerationPage = lazy(() =>
  import('./pages/ModerationPage').then((m) => ({ default: m.ModerationPage })),
);
const BookingCompletionsPage = lazy(() =>
  import('./pages/BookingCompletionsPage').then((m) => ({ default: m.BookingCompletionsPage })),
);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
export function App() {
  const t = useStrings();
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
                  <Route path="/" element={<RedirectWithQuery to="/home" />} />
                  <Route path="/home" element={<ExplorePage />} />
                  <Route path="/explore" element={<ExploreRoute />} />
                  <Route path="/photographers" element={<PhotographerDirectoryRoute />} />
                  <Route
                    path="/studios"
                    element={<ProviderDirectoryPage key="studios" type="studio" />}
                  />
                  <Route path="/genres" element={<GenreIndexRedirect />} />
                  <Route path="/genres/:genre" element={<GenrePage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/search" element={<RedirectWithQuery to="/explore" />} />
                  <Route path="/support" element={<GuidePage topic="support" />} />
                  <Route path="/community" element={<GuidePage topic="community" />} />
                  <Route path="/privacy" element={<GuidePage topic="privacy" />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/auth/callback" element={<AuthPage callback />} />
                  <Route path="/reset-password" element={<AuthPage recovery />} />
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route path="/providers/:type/:id" element={<ProviderPage />} />
                  <Route path="/portfolios/:id" element={<PortfolioDetailPage />} />
                  <Route
                    path="/messages"
                    element={
                      <RequireAuth>
                        <MessagesPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    element={
                      <RequireAuth>
                        <ProfileLayout />
                      </RequireAuth>
                    }
                  >
                    <Route path="/profile" element={<AccountPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
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
                          <BookingRequestPage />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/bookings/live/:id"
                      element={
                        <RequireAuth>
                          <BookingPage />
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
                      path="/studio"
                      element={
                        <RequireAuth roles={['photographer', 'studio_manager']}>
                          <StudioPage />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/studio/:id"
                      element={
                        <RequireAuth roles={['photographer', 'studio_manager']}>
                          <StudioDetailPage />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/portfolio"
                      element={
                        <RequireAuth roles={['photographer', 'studio_manager']}>
                          <PortfolioPage />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/portfolio/services/:id/edit"
                      element={
                        <RequireAuth roles={['photographer']}>
                          <ServiceEditPage />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/portfolio/new"
                      element={
                        <RequireAuth roles={['photographer']}>
                          <PortfolioCreatePage />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/admin"
                      element={
                        <RequireAuth roles={['system_admin']}>
                          <ModerationPage />
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
                  </Route>
                  <Route path="/bookings/live" element={<Navigate to="/bookings" replace />} />
                  <Route path="/health" element={<HomePage />} />
                  <Route
                    path="*"
                    element={
                      <>
                        <h1>{t.notFound}</h1>
                        <Link to="/">{t.home}</Link>
                      </>
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
