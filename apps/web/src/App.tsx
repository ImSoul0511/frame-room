import { lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import vietnameseCatalog from '@astryxdesign/core/locales/vi-VN.generated.js';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';

const HomePage = lazy(() =>
  import('./pages/HomePage').then((page) => ({ default: page.HomePage })),
);
import { useLanguage, useStrings } from './lib/i18n';
import { AuthProvider, RequireAuth } from './lib/auth';
import { AppLayout } from './components/AppLayout';
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
const ProjectsPage = lazy(() =>
  import('./pages/ProjectsPage').then((page) => ({ default: page.ProjectsPage })),
);
const ProjectPage = lazy(() =>
  import('./pages/ProjectsPage').then((page) => ({ default: page.ProjectPage })),
);
const BookingsPage = lazy(() =>
  import('./pages/BookingsPage').then((page) => ({ default: page.BookingsPage })),
);
const BookingPage = lazy(() =>
  import('./pages/BookingsPage').then((page) => ({ default: page.BookingPage })),
);
const StudioPage = lazy(() =>
  import('./pages/StudioPage').then((page) => ({ default: page.StudioPage })),
);
const StudioDetailPage = lazy(() =>
  import('./pages/StudioPage').then((page) => ({ default: page.StudioDetailPage })),
);
const PortfolioPage = lazy(() =>
  import('./pages/PortfolioPage').then((page) => ({ default: page.PortfolioPage })),
);
const PortfolioDetailPage = lazy(() =>
  import('./pages/PortfolioPage').then((page) => ({ default: page.PortfolioDetailPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((page) => ({ default: page.SettingsPage })),
);
const AdminPage = lazy(() =>
  import('./pages/SettingsPage').then((page) => ({ default: page.AdminPage })),
);

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

export function App() {
  const strings = useStrings();
  const { language } = useLanguage();

  return (
    <QueryClientProvider client={queryClient}>
      <InternationalizationProvider
        locale={language === 'vi' ? 'vi-VN' : 'en'}
        messages={{ 'vi-VN': vietnameseCatalog }}
      >
        <Theme theme={neutralTheme}>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Navigate to="/explore" replace />} />
                  <Route path="/explore" element={<ExplorePage />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/auth/callback" element={<Navigate to="/projects" replace />} />
                  <Route path="/reset-password" element={<AuthPage recovery />} />
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route path="/providers/:type/:id" element={<ProviderPage />} />
                  <Route path="/portfolios/:id" element={<PortfolioDetailPage />} />
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
                      <RequireAuth>
                        <StudioPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/studio/:id"
                    element={
                      <RequireAuth>
                        <StudioDetailPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/portfolio"
                    element={
                      <RequireAuth>
                        <PortfolioPage />
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
                    path="/admin"
                    element={
                      <RequireAuth>
                        <AdminPage />
                      </RequireAuth>
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
            </AuthProvider>
          </BrowserRouter>
        </Theme>
      </InternationalizationProvider>
    </QueryClientProvider>
  );
}
