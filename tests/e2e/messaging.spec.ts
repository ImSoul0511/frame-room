import { expect, test } from '@playwright/test';

test('quick chat expands into the same project room and keeps its draft', async ({ page }) => {
  const projectUrl = process.env.VITE_SUPABASE_URL;
  test.skip(!projectUrl, 'Requires the configured public Auth client.');
  const id = '11111111-1111-4111-8111-111111111111';
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id,
    email: 'chat@example.test',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'email' },
    user_metadata: { registration_role: 'client' },
    created_at: new Date().toISOString(),
  };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, aud: 'authenticated', exp: now + 3600, iat: now })}.test-signature`;
  await page.addInitScript(
    ({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
    },
    {
      key: `sb-${new URL(projectUrl!).hostname.split('.')[0]}-auth-token`,
      session: {
        access_token: token,
        refresh_token: 'fixture',
        expires_at: now + 3600,
        expires_in: 3600,
        token_type: 'bearer',
        user,
      },
    },
  );
  await page.route(`${new URL(projectUrl!).origin}/**`, (route) => route.abort());
  const peer = {
    clientId: id,
    clientName: 'Client',
    photographerId: 'photo',
    studioId: null,
    providerName: 'Alex',
  };
  const messages: {
    id: string;
    text: string;
    type: string;
    senderId: string;
    senderName: string;
    createdAt: string;
  }[] = [];
  await page.route('**/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path === '/v1/me') data = { id, displayName: 'Client', roles: ['client'] };
    if (path === '/v1/conversations') data = [{ ...peer, id: 'direct-thread' }];
    if (path === '/v1/project-conversations')
      data = [
        {
          ...peer,
          id: 'project-room',
          bookingId: 'booking',
          projectTitle: 'City portraits',
          roomStatus: 'open',
        },
      ];
    if (path === '/v1/shoot-rooms/project-room/messages') {
      if (route.request().method() === 'POST') {
        messages.push({
          id: 'first',
          text: route.request().postDataJSON().text,
          type: 'text',
          senderId: id,
          senderName: 'Client',
          createdAt: new Date().toISOString(),
        });
      }
      data = { items: messages, before: null };
    }
    await route.fulfill({ json: { data } });
  });
  await page.goto('/about');
  await page.locator('button.floating-chat').click();
  const mini = page.getByRole('dialog');
  await expect(mini.getByRole('link', { name: /Alex/ })).toBeVisible();
  await mini.locator('.inbox-filters button').nth(1).click();
  await mini.getByRole('link', { name: /City portraits/ }).click();
  await mini.getByRole('textbox').fill('See you at sunrise');
  await expect(page).toHaveURL(/\/about$/);
  await mini.locator('a.chat-icon').click();
  await expect(page).toHaveURL(/\/messages\?room=project-room$/);
  const input = page.getByRole('textbox').filter({ visible: true }).last();
  await expect(input).toHaveValue('See you at sunrise');
  await input.press('Enter');
  await expect(page.locator('.messenger-history')).toContainText('See you at sunrise');
  await page.setViewportSize({ width: 375, height: 800 });
  await page.locator('.messenger-back').click();
  await expect(page.getByRole('link', { name: /City portraits/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
