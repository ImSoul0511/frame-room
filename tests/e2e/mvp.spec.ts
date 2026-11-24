import { test, expect, type Page } from '@playwright/test';

test('English default and persistent bilingual preference preserve form input', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Every perspective, a story to tell.' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByLabel('Language', { exact: true }).click();
  await page.getByRole('option', { name: 'Tiếng Việt', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mỗi góc nhìn, một câu chuyện.' })).toBeVisible();
  await page.goto('/auth');
  await page.getByLabel(/^Email/).fill('draft@example.test');
  await page.getByLabel('Ngôn ngữ', { exact: true }).click();
  await page.getByRole('option', { name: 'English', exact: true }).click();
  await expect(page.getByLabel(/^Email/)).toHaveValue('draft@example.test');
  await expect(page.getByLabel(/^Password/)).toBeVisible();
  await page.getByLabel('Language', { exact: true }).click();
  await page.getByRole('option', { name: 'Tiếng Việt', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel(/^Mật khẩu/)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
});
test('mobile navigation and language controls fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/explore');
  await expect(page.getByLabel('Language', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByLabel('Language', { exact: true }).focus();
  await page.keyboard.press('Home');
  await expect(page.getByLabel('Language', { exact: true })).toBeFocused();
});
test('account routes preserve a return path for an unsigned visitor', async ({ page }) => {
  await page.goto('/messages?conversation=example');
  await expect(page).toHaveURL(/\/auth\?/);
  expect(new URL(page.url()).searchParams.get('next')).toBe('/messages?conversation=example');
});
async function login(page: Page, email: string, home: string) {
  await page.goto('/auth');
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(process.env.FRAME_ROOM_E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${home}$`));
}
const cloudJourneyConfigured = Boolean(
  process.env.CLOUD_TEST_DATABASE_URL &&
  process.env.CLOUD_TEST_PROJECT_REF &&
  process.env.VITE_SUPABASE_URL === `https://${process.env.CLOUD_TEST_PROJECT_REF}.supabase.co` &&
  process.env.DATABASE_URL === process.env.CLOUD_TEST_DATABASE_URL &&
  process.env.FRAME_ROOM_E2E_CLIENT_EMAIL &&
  process.env.FRAME_ROOM_E2E_MANAGER_EMAIL &&
  process.env.FRAME_ROOM_E2E_OUTSIDER_EMAIL &&
  process.env.FRAME_ROOM_E2E_PASSWORD,
);
test('real client and studio manager complete a private shoot workflow', async ({
  browser,
  request,
}) => {
  test.skip(!cloudJourneyConfigured, 'Requires disposable Cloud database and synthetic accounts.');
  const clientContext = await browser.newContext();
  const managerContext = await browser.newContext();
  const outsiderContext = await browser.newContext();
  const client = await clientContext.newPage();
  const manager = await managerContext.newPage();
  const outsider = await outsiderContext.newPage();
  try {
    await login(client, process.env.FRAME_ROOM_E2E_CLIENT_EMAIL!, '/projects');
    await client.getByRole('button', { name: 'Start an idea', exact: true }).click();
    const title = `Browser verification ${Date.now()}`;
    await client.getByLabel(/^Project name/).fill(title);
    await client
      .getByLabel('Describe your idea', { exact: true })
      .fill('A natural-light portrait session, with a private client and studio workflow.');
    await client.getByRole('button', { name: 'Create project', exact: true }).click();
    await expect(client).toHaveURL(/\/projects\/[a-f0-9-]+/);
    const projectId = client.url().split('/').at(-1)!;
    const apiOrigin = process.env.VITE_API_URL ?? 'http://localhost:4000';
    const studios = (await (await request.get(`${apiOrigin}/v1/studios`)).json()).data as {
      id: string;
      displayName: string;
    }[];
    const studio = studios.find((s) => s.displayName === 'Still Studio');
    expect(studio).toBeTruthy();
    await client.goto(`/providers/studio/${studio!.id}?project=${projectId}`);
    await client.getByRole('button', { name: 'Choose this service', exact: true }).first().click();
    await client.getByLabel('Location type', { exact: true }).click();
    await client.getByRole('option', { name: 'Studio', exact: true }).click();
    const start = new Date(
      Date.UTC(
        2040 + Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 12),
        1 + Math.floor(Math.random() * 28),
        3 + Math.floor(Math.random() * 12),
      ),
    );
    const local = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    await client.getByLabel('Starts', { exact: true }).fill(local(start));
    await client
      .getByLabel('Ends', { exact: true })
      .fill(local(new Date(start.getTime() + 7200000)));
    await client.getByRole('button', { name: 'Request booking', exact: true }).click();
    await expect(client).toHaveURL(/\/bookings\/[a-f0-9-]+/);
    const bookingUrl = new URL(client.url()).pathname;
    await login(manager, process.env.FRAME_ROOM_E2E_MANAGER_EMAIL!, '/studio');
    await manager.goto(bookingUrl);
    await expect(
      manager.getByRole('button', { name: 'Confirm booking', exact: true }),
    ).toBeDisabled();
    await manager.getByRole('button', { name: 'Approve this version', exact: true }).click();
    await manager.getByRole('button', { name: 'Assigned photographer', exact: true }).click();
    await manager.getByRole('dialog').getByLabel('Photographer', { exact: true }).click();
    await manager.getByRole('option', { name: 'Linh Nguyen', exact: true }).click();
    await manager
      .getByRole('dialog')
      .getByRole('button', { name: 'Assigned photographer', exact: true })
      .click();
    await manager.getByRole('button', { name: 'Confirm booking', exact: true }).click();
    await manager.getByRole('dialog').getByLabel('Daylight room', { exact: true }).check();
    await manager
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirm booking', exact: true })
      .click();
    await expect(manager.getByText('Confirmed', { exact: true })).toBeVisible();
    await client.reload();
    await expect(client.getByRole('heading', { name: 'Version 1', exact: true })).toBeVisible();
    await manager.getByRole('button', { name: 'Start shoot', exact: true }).click();
    await expect(manager.getByText('In progress', { exact: true })).toBeVisible();
    await manager.getByRole('tab', { name: 'Photo selection', exact: true }).click();
    const fixture = {
      name: 'proof.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=',
        'base64',
      ),
    };
    await manager.getByLabel('Add previews', { exact: true }).setInputFiles(fixture);
    await expect(manager.getByRole('img', { name: 'proof.png', exact: true })).toBeVisible();
    await manager.getByRole('button', { name: 'Open photo selection', exact: true }).click();
    await client.reload();
    await client.getByRole('tab', { name: 'Photo selection', exact: true }).click();
    await client.getByRole('checkbox', { name: 'Selected: proof.png', exact: true }).check();
    await client.getByRole('button', { name: 'Submit selection', exact: true }).click();
    await expect(client.getByRole('button', { name: 'Submit selection', exact: true })).toHaveCount(
      0,
    );
    await manager.reload();
    await manager.getByRole('tab', { name: 'Delivery', exact: true }).click();
    await manager
      .getByLabel('Add final photos', { exact: true })
      .setInputFiles({ ...fixture, name: 'final.png' });
    await expect(manager.getByText('final.png', { exact: true })).toBeVisible();
    await manager.getByRole('button', { name: 'Deliver photos', exact: true }).click();
    await expect(manager.getByText('Delivered', { exact: true })).toBeVisible();
    await client.reload();
    await client.getByRole('button', { name: 'Confirm completion', exact: true }).click();
    await client.getByRole('tab', { name: 'Delivery', exact: true }).click();
    await client
      .getByLabel('Comment', { exact: true })
      .fill('Verified from the browser on the test project.');
    await client.getByRole('button', { name: 'Submit review', exact: true }).click();
    await expect(
      client.getByText('Verified from the browser on the test project.', { exact: true }),
    ).toBeVisible();
    await login(outsider, process.env.FRAME_ROOM_E2E_OUTSIDER_EMAIL!, '/bookings');
    await outsider.goto(bookingUrl);
    await expect(outsider.getByRole('alert')).toContainText('unavailable');
  } finally {
    await clientContext.close();
    await managerContext.close();
    await outsiderContext.close();
  }
});
