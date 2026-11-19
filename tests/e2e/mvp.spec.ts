import { test, expect, type Page } from '@playwright/test';

test('English default and persistent bilingual preference preserve form input', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'What does your next shoot look like?' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByLabel('Language', { exact: true }).selectOption('vi');
  await expect(
    page.getByRole('heading', { name: 'Bạn đang hình dung bộ ảnh như thế nào?' }),
  ).toBeVisible();
  await page.goto('/auth');
  await page.getByLabel(/^Email/).fill('draft@example.test');
  await page.getByLabel('Ngôn ngữ', { exact: true }).selectOption('en');
  await expect(page.getByLabel(/^Email/)).toHaveValue('draft@example.test');
  await expect(page.getByLabel(/^Password/)).toBeVisible();
  await page.getByLabel('Language', { exact: true }).selectOption('vi');
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
async function login(page: Page, email: string) {
  await page.goto('/auth');
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill('FrameRoom-Demo-2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/projects/);
  await expect(page.getByRole('heading', { name: 'Creative projects', exact: true })).toBeVisible();
}
test('real client and studio manager complete a private shoot workflow', async ({
  browser,
  request,
}) => {
  const clientContext = await browser.newContext();
  const managerContext = await browser.newContext();
  const outsiderContext = await browser.newContext();
  const client = await clientContext.newPage();
  const manager = await managerContext.newPage();
  const outsider = await outsiderContext.newPage();
  try {
    await login(client, 'client@frameroom.test');
    await client.getByRole('button', { name: 'Start an idea', exact: true }).click();
    const title = `Browser verification ${Date.now()}`;
    await client.getByLabel(/^Project name/).fill(title);
    await client
      .getByLabel('Describe your idea', { exact: true })
      .fill('A natural-light portrait session, with a private client and studio workflow.');
    await client.getByRole('button', { name: 'Create project', exact: true }).click();
    await expect(client).toHaveURL(/\/projects\/[a-f0-9-]+/);
    const projectId = client.url().split('/').at(-1)!;
    const studios = (await (await request.get('http://localhost:4000/v1/studios')).json()).data as {
      id: string;
      displayName: string;
    }[];
    const studio = studios.find((s) => s.displayName === 'Still Studio');
    expect(studio).toBeTruthy();
    await client.goto(`/providers/studio/${studio!.id}?project=${projectId}`);
    await client.getByRole('button', { name: 'Choose this service', exact: true }).click();
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
    await login(manager, 'manager@frameroom.test');
    await manager.goto(bookingUrl);
    await manager.getByRole('button', { name: 'Confirm booking', exact: true }).click();
    await manager
      .getByRole('dialog')
      .getByLabel('Assigned photographer', { exact: true })
      .selectOption({ label: 'Linh Nguyen' });
    await manager.getByRole('dialog').getByLabel('Daylight room', { exact: true }).check();
    await manager
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirm booking', exact: true })
      .click();
    await expect(manager.getByText('Confirmed', { exact: true })).toBeVisible();
    await client.reload();
    await client.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(client.getByRole('heading', { name: 'Version 1', exact: true })).toBeVisible();
    await manager.reload();
    await manager.getByRole('button', { name: 'Approve this version', exact: true }).click();
    await expect(
      manager.getByRole('button', { name: 'Approve this version', exact: true }),
    ).toHaveCount(0);
    await manager.getByRole('button', { name: 'Start shoot', exact: true }).click();
    await expect(manager.getByText('In progress', { exact: true })).toBeVisible();
    await manager.getByRole('tab', { name: 'Photo selection', exact: true }).click();
    const explore = (await (await request.get('http://localhost:4000/v1/explore')).json()).data as {
      coverUrl: string | null;
    }[];
    const cover = explore.find((p) => p.coverUrl)?.coverUrl;
    expect(cover).toBeTruthy();
    const image = await request.get(cover!);
    const fixture = { name: 'proof.webp', mimeType: 'image/webp', buffer: await image.body() };
    await manager.getByLabel('Add previews', { exact: true }).setInputFiles(fixture);
    await expect(manager.getByRole('img', { name: 'proof.webp', exact: true })).toBeVisible();
    await manager.getByRole('button', { name: 'Open photo selection', exact: true }).click();
    await client.reload();
    await client.getByRole('tab', { name: 'Photo selection', exact: true }).click();
    await client.getByRole('checkbox', { name: 'Selected: proof.webp', exact: true }).check();
    await client.getByRole('button', { name: 'Submit selection', exact: true }).click();
    await expect(client.getByRole('button', { name: 'Submit selection', exact: true })).toHaveCount(
      0,
    );
    await manager.reload();
    await manager.getByRole('tab', { name: 'Delivery', exact: true }).click();
    await manager
      .getByLabel('Add final photos', { exact: true })
      .setInputFiles({ ...fixture, name: 'final.webp' });
    await expect(manager.getByText('final.webp', { exact: true })).toBeVisible();
    await manager.getByRole('button', { name: 'Deliver photos', exact: true }).click();
    await expect(manager.getByText('Delivered', { exact: true })).toBeVisible();
    await client.reload();
    await client.getByRole('button', { name: 'Confirm completion', exact: true }).click();
    await client.getByRole('tab', { name: 'Delivery', exact: true }).click();
    await client
      .getByLabel('Comment', { exact: true })
      .fill('Verified from the browser with real local services.');
    await client.getByRole('button', { name: 'Submit review', exact: true }).click();
    await expect(
      client.getByText('Verified from the browser with real local services.', { exact: true }),
    ).toBeVisible();
    await login(outsider, 'food@frameroom.test');
    await outsider.goto(bookingUrl);
    await expect(outsider.getByRole('alert')).toContainText('unavailable');
  } finally {
    await clientContext.close();
    await managerContext.close();
    await outsiderContext.close();
  }
});
