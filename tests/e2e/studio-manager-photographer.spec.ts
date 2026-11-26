import { test, expect } from '@playwright/test';

test('a sole studio manager creates a photographer profile without losing manager permissions', async ({
  page,
}) => {
  const projectUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  test.skip(!projectUrl, 'Requires configured Auth client; all requests use isolated fixtures.');
  const userId = '11111111-1111-4111-8111-111111111111';
  const studioId = '22222222-2222-4222-8222-222222222222';
  const photographerId = '33333333-3333-4333-8333-333333333333';
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: userId,
    email: 'manager@example.test',
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
  let photographer: Record<string, unknown> | null = null;
  const memberMutations: string[] = [];
  const member = () => ({
    userId,
    role: 'manager',
    displayName: 'Manager',
    userName: 'manager',
    photographerId: photographer ? photographerId : null,
  });
  await page.route('**/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/members/') && route.request().method() !== 'GET')
      memberMutations.push(path);
    let data: unknown = [];
    if (path === '/v1/me')
      data = {
        id: userId,
        userName: 'manager',
        displayName: 'Manager',
        roles: photographer
          ? ['client', 'studio_manager', 'photographer']
          : ['client', 'studio_manager'],
        createdAt: new Date().toISOString(),
      };
    else if (path === '/v1/me/studios')
      data = [
        {
          id: studioId,
          name: 'Test Studio',
          city: 'Hồ Chí Minh',
          genres: ['portrait'],
          role: 'manager',
        },
      ];
    else if (path.endsWith('/team')) data = [member()];
    else if (path.endsWith('/dashboard')) data = { stats: {}, upcoming: [] };
    else if (path.endsWith('/availability-setting')) data = { availabilityPublic: false };
    else if (path === '/v1/photographers/me') {
      if (route.request().method() === 'POST')
        photographer = {
          ...route.request().postDataJSON(),
          id: photographerId,
          userId,
          styles: [],
          isHidden: false,
        };
      data = photographer;
    }
    await route.fulfill({ json: { data } });
  });
  await page.goto(`/studio/${studioId}`);
  await page.getByRole('button', { name: 'Team', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove manager permissions' })).toBeDisabled();
  await page.getByRole('button', { name: 'Create your photographer profile', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'City', exact: true }).click();
  await page.getByRole('option', { name: /Ho Chi Minh/ }).click();
  await dialog.getByLabel(/Contact information/).fill('manager@example.test');
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.member-row small')).toContainText('Manager');
  await expect(page.locator('.member-row small')).toContainText('Photographer');
  await expect(page.getByRole('button', { name: 'Remove manager permissions' })).toBeDisabled();
  expect(photographer).not.toBeNull();
  expect(memberMutations).toEqual([]);
});
