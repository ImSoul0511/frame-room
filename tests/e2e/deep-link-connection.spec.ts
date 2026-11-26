import { test, expect } from '@playwright/test';

for (const path of ['/profile', '/studio/22222222-2222-4222-8222-222222222222']) {
  test(`opening ${path} waits for profile and recovers from API startup failure`, async ({
    page,
  }) => {
    const projectUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
    test.skip(!projectUrl, 'Requires Auth configuration; requests use isolated fixtures.');
    const userId = '11111111-1111-4111-8111-111111111111';
    const now = Math.floor(Date.now() / 1000);
    const user = {
      id: userId,
      email: 'connection@example.test',
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: { provider: 'email' },
      user_metadata: { registration_role: 'client' },
      created_at: new Date().toISOString(),
      email_confirmed_at: new Date().toISOString(),
    };
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, aud: 'authenticated', role: 'authenticated', exp: now + 3600, iat: now })}.isolated-signature`;
    await page.addInitScript(
      ({ key, session }) => {
        localStorage.setItem('frameroom.language', 'en');
        localStorage.setItem(key, JSON.stringify(session));
      },
      {
        key: `sb-${new URL(projectUrl!).hostname.split('.')[0]}-auth-token`,
        session: {
          access_token: token,
          refresh_token: 'test-refresh',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: now + 3600,
          user,
        },
      },
    );
    await page.route(`${projectUrl}/**`, (route) => route.fulfill({ json: user }));
    let online = false;
    let profileRequests = 0;
    let inboxRequests = 0;
    await page.route('**/v1/**', async (route) => {
      const url = new URL(route.request().url());
      expect(url.hostname).toBe('127.0.0.1');
      if (url.pathname === '/v1/me') {
        profileRequests++;
        if (!online) return route.abort('connectionrefused');
        return route.fulfill({
          json: {
            data: {
              id: userId,
              displayName: 'Connection Check',
              userName: 'connection',
              roles: ['client', 'studio_manager'],
              createdAt: new Date().toISOString(),
            },
          },
        });
      }
      if (url.pathname === '/v1/conversations' || url.pathname === '/v1/project-conversations')
        inboxRequests++;
      const data =
        url.pathname === '/v1/photographers/me'
          ? null
          : url.pathname === '/v1/me/studios'
            ? [
                {
                  id: '22222222-2222-4222-8222-222222222222',
                  name: 'Connection Studio',
                  city: 'Hồ Chí Minh',
                  genres: ['portrait'],
                  role: 'manager',
                },
              ]
            : url.pathname.endsWith('/dashboard')
              ? { stats: {}, upcoming: [] }
              : url.pathname.endsWith('/availability-setting')
                ? { availabilityPublic: false }
                : [];
      return route.fulfill({ json: { data } });
    });
    await page.goto(path);
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('connect');
    expect(profileRequests).toBe(1);
    expect(inboxRequests).toBe(0);
    await page.clock.install();
    await page.clock.fastForward(46_000);
    expect(profileRequests).toBe(1);
    expect(inboxRequests).toBe(0);
    online = true;
    await alert.getByRole('button').click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect.poll(() => inboxRequests).toBeGreaterThan(0);
    expect(profileRequests).toBe(2);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  });
}
