import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';

import { HomePage } from './pages/HomePage';
import { strings } from './strings';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme theme={neutralTheme}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route
              path="*"
              element={
                <main>
                  <h1>{strings.notFound}</h1>
                  <Link to="/">{strings.home}</Link>
                </main>
              }
            />
          </Routes>
        </BrowserRouter>
      </Theme>
    </QueryClientProvider>
  );
}
