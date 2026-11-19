import { lazy, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import vietnameseCatalog from '@astryxdesign/core/locales/vi-VN.generated.js';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { useLanguage, useStrings } from './lib/i18n';
import { AuthProvider, RequireAuth } from './lib/auth';
import { AppLayout } from './components/AppLayout';
import { DemoProvider, DemoGate, useDemo } from './features/demo/DemoContext';

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
const LiveBookingsPage = lazy(() =>
  import('./pages/BookingsPage').then((page) => ({ default: page.BookingsPage })),
);
const LiveBookingPage = lazy(() =>
  import('./pages/BookingsPage').then((page) => ({ default: page.BookingPage })),
);
const BookingCompletionsPage = lazy(() =>
  import('./pages/BookingCompletionsPage').then((page) => ({
    default: page.BookingCompletionsPage,
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
const LiveAccount = lazy(() =>
  import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })),
);
const LiveSettings = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const LiveAdmin = lazy(() =>
  import('./pages/ModerationPage').then((m) => ({ default: m.ModerationPage })),
);
const LiveNotifications = lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const LiveStudio = lazy(() =>
  import('./pages/StudioPage').then((m) => ({ default: m.StudioPage })),
);
const LiveStudioDetail = lazy(() =>
  import('./pages/StudioPage').then((m) => ({ default: m.StudioDetailPage })),
);
const LivePortfolio = lazy(() =>
  import('./pages/PortfolioPage').then((m) => ({ default: m.PortfolioPage })),
);
const LivePortfolioDetail = lazy(() =>
  import('./pages/PortfolioPage').then((m) => ({ default: m.PortfolioDetailPage })),
);
const LiveProjects = lazy(() =>
  import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
);
const LiveProject = lazy(() =>
  import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectPage })),
);
const LiveBookingCreate = lazy(() =>
  import('./pages/BookingRequestPage').then((m) => ({ default: m.BookingRequestPage })),
);
const LiveMessages = lazy(() =>
  import('./pages/MessagesPage').then((m) => ({ default: m.MessagesPage })),
);

function AccountRoute({
  live,
  demo,
  roles,
  accountRoles,
}: {
  live: ReactNode;
  demo: ReactNode;
  roles?: Parameters<typeof DemoGate>[0]['roles'];
  accountRoles?: readonly string[];
}) {
  const { choice } = useDemo();
  return choice === 'account' ? (
    <RequireAuth roles={accountRoles}>{live}</RequireAuth>
  ) : (
    <DemoGate roles={roles}>{demo}</DemoGate>
  );
}

function PortfolioRoute() {
  const { choice } = useDemo();
  return choice === 'account' ? <LivePortfolioDetail /> : <PortfolioDetailPage />;
}

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
                    <Route path="/portfolios/:id" element={<PortfolioRoute />} />
                    <Route
                      path="/profile"
                      element={<AccountRoute demo={<AccountPage />} live={<LiveAccount />} />}
                    />
                    <Route
                      path="/settings"
                      element={
                        <AccountRoute demo={<AccountPage editing />} live={<LiveSettings />} />
                      }
                    />
                    <Route
                      path="/notifications"
                      element={
                        <AccountRoute demo={<NotificationsPage />} live={<LiveNotifications />} />
                      }
                    />
                    <Route
                      path="/projects"
                      element={
                        <AccountRoute
                          roles={['client']}
                          demo={<ProjectsPage />}
                          live={<LiveProjects />}
                        />
                      }
                    />
                    <Route
                      path="/projects/:id"
                      element={
                        <AccountRoute
                          roles={['client']}
                          demo={<ProjectPage />}
                          live={<LiveProject />}
                        />
                      }
                    />
                    <Route
                      path="/bookings"
                      element={
                        <AccountRoute
                          roles={participants}
                          demo={<BookingsPage />}
                          live={<LiveBookingsPage />}
                        />
                      }
                    />
                    <Route
                      path="/bookings/new"
                      element={
                        <AccountRoute
                          roles={['client']}
                          demo={<BookingCreatePage />}
                          live={<LiveBookingCreate />}
                        />
                      }
                    />
                    <Route
                      path="/bookings/live"
                      element={
                        <RequireAuth>
                          <LiveBookingsPage />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/bookings/live/:id"
                      element={
                        <RequireAuth>
                          <LiveBookingPage />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/bookings/:id"
                      element={
                        <AccountRoute
                          roles={participants}
                          demo={<BookingPage />}
                          live={<LiveBookingPage />}
                        />
                      }
                    />
                    <Route
                      path="/messages"
                      element={
                        <AccountRoute
                          roles={participants}
                          demo={<MessagesPage />}
                          live={<LiveMessages />}
                        />
                      }
                    />
                    <Route
                      path="/studio"
                      element={
                        <AccountRoute
                          roles={professionals}
                          accountRoles={['photographer']}
                          demo={<StudioPage />}
                          live={<LiveStudio />}
                        />
                      }
                    />
                    <Route
                      path="/studio/:id"
                      element={
                        <AccountRoute
                          roles={professionals}
                          accountRoles={['photographer']}
                          demo={<StudioPage />}
                          live={<LiveStudioDetail />}
                        />
                      }
                    />
                    <Route
                      path="/portfolio"
                      element={
                        <AccountRoute
                          roles={professionals}
                          accountRoles={['photographer']}
                          demo={<PortfolioPage />}
                          live={<LivePortfolio />}
                        />
                      }
                    />
                    <Route
                      path="/admin"
                      element={
                        <AccountRoute
                          roles={['admin']}
                          accountRoles={['system_admin']}
                          demo={<AdminPage />}
                          live={<LiveAdmin />}
                        />
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
