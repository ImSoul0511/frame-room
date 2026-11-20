import { atelierVietnamese } from '../../apps/web/src/locales/atelier';
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

test('English default and persistent bilingual preference preserve form input', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'An idea. A connection. A frame worth keeping.' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByLabel('Language', { exact: true }).selectOption('vi');
  await expect(page.locator('.atelier-hero h1')).toContainText(atelierVietnamese.heroFirst);
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
const localJourneyConfigured =
  process.env.FRAME_ROOM_E2E_LOCAL_PROJECT === 'frameroom-atelier-verification' &&
  process.env.VITE_SUPABASE_URL === 'http://127.0.0.1:56321' &&
  Boolean(process.env.DATABASE_URL?.includes('@127.0.0.1:56322/'));
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
  test.skip(
    !(cloudJourneyConfigured || localJourneyConfigured),
    'Requires a designated disposable project and synthetic accounts.',
  );
  const clientContext = await browser.newContext();
  const managerContext = await browser.newContext();
  const outsiderContext = await browser.newContext();
  const client = await clientContext.newPage();
  const manager = await managerContext.newPage();
  const outsider = await outsiderContext.newPage();
  try {
    const fixture = {
      name: 'proof.jpg',
      mimeType: 'image/jpeg',
      buffer: readFileSync('apps/web/public/images/editorial-portrait.jpg'),
    };
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
    await client.getByLabel('Add image', { exact: true }).setInputFiles(fixture);
    await expect(client.locator('.atelier-board figure img')).toHaveCount(1);
    await client.reload();
    await expect(client.locator('.atelier-board figure img')).toHaveCount(1);
    for (const width of [1280, 768, 375]) {
      await client.setViewportSize({ width, height: 900 });
      expect(await client.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await client.screenshot({
        path: `.artifacts/ATELIER-001-board-${width}.png`,
        fullPage: true,
      });
    }
    await client.setViewportSize({ width: 1280, height: 900 });
    await client.getByRole('button', { name: 'Creative tools', exact: true }).click();
    await expect(client.getByRole('dialog')).toContainText('Creative tools are unavailable');
    await client.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();

    await client
      .locator('.tabs')
      .getByRole('button', { name: 'Shoot agreement', exact: true })
      .click();
    await client.getByLabel(/^Preparation/).fill('Check lighting\nPack lenses\nCheck lighting');
    await client.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(client.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled();
    await client.reload();

    const apiOrigin = process.env.VITE_API_URL ?? 'http://localhost:4000';
    const studios = (await (await request.get(`${apiOrigin}/v1/studios`)).json()).data as {
      id: string;
      displayName: string;
    }[];
    const studio = studios.find((s) => s.displayName === 'Still Studio');
    expect(studio).toBeTruthy();
    await client.goto(`/providers/studio/${studio!.id}?project=${projectId}`);
    await client.getByRole('button', { name: 'Services', exact: true }).click();
    await client.getByRole('button', { name: 'Choose this service', exact: true }).first().click();
    await client.getByRole('button', { name: 'Continue', exact: true }).click();
    await client.getByLabel('Location type', { exact: true }).selectOption('studio');
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
    await client.getByRole('button', { name: 'Continue', exact: true }).click();
    await client.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(client).toHaveURL(/\/bookings\/new\?/);
    await client.getByRole('button', { name: 'Request booking', exact: true }).click();
    await expect(client).toHaveURL(/\/bookings\/[a-f0-9-]+/);
    const bookingUrl = new URL(client.url()).pathname;
    await login(manager, process.env.FRAME_ROOM_E2E_MANAGER_EMAIL!, '/studio');
    await expect(manager.getByRole('link', { name: /Still Studio/ })).toBeVisible();
    await manager.goto(bookingUrl);
    await expect(
      manager.getByRole('button', { name: 'Confirm booking', exact: true }),
    ).toBeDisabled();
    await manager.getByRole('tab', { name: 'Shoot agreement', exact: true }).click();
    await manager.getByRole('button', { name: 'Approve this version', exact: true }).click();
    await manager.getByRole('button', { name: 'Assigned photographer', exact: true }).click();
    await manager
      .getByRole('dialog')
      .getByLabel('Photographer', { exact: true })
      .selectOption({ label: 'Linh Nguyen' });
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
    await client.getByRole('tab', { name: 'Shoot agreement', exact: true }).click();
    await expect(client.getByRole('heading', { name: 'Version 1', exact: true })).toBeVisible();
    await client.getByRole('tab', { name: 'Shoot room', exact: true }).click();
    await manager.getByRole('tab', { name: 'Shoot room', exact: true }).click();
    const imports = [client, manager].map((page) =>
      page.waitForResponse(
        (response) =>
          response.url().endsWith('/checklist') && response.request().method() === 'POST',
      ),
    );
    await Promise.all(
      [client, manager].map((page) =>
        page.getByRole('button', { name: 'Import agreed checklist', exact: true }).click(),
      ),
    );
    const counts = await Promise.all(
      imports.map(async (response) => (await (await response).json()).data.count as number),
    );
    expect(counts.sort()).toEqual([0, 2]);
    await client.getByRole('button', { name: 'Import agreed checklist', exact: true }).click();
    await expect(client.getByText('0 tasks added', { exact: true })).toBeVisible();
    await expect(client.getByRole('checkbox', { name: /Check lighting/ })).toHaveCount(1);
    await client.reload();
    await client.getByRole('tab', { name: 'Shoot room', exact: true }).click();
    await expect(client.getByRole('checkbox', { name: /Pack lenses/ })).toHaveCount(1);
    await manager.getByRole('button', { name: 'Start shoot', exact: true }).click();
    await expect(manager.locator('.status-in_progress')).toBeVisible();
    await manager.getByRole('tab', { name: 'Photo selection', exact: true }).click();
    await manager.getByLabel('Add previews', { exact: true }).setInputFiles(fixture);
    await expect(manager.getByRole('img', { name: 'proof.jpg', exact: true })).toBeVisible();
    await manager
      .getByLabel('Add previews', { exact: true })
      .setInputFiles({ ...fixture, name: 'alternate.jpg' });
    await expect(manager.locator('.contact-frame')).toHaveCount(2);
    await manager.getByRole('button', { name: 'Open photo selection', exact: true }).click();
    await client.reload();
    await client.getByRole('tab', { name: 'Photo selection', exact: true }).click();
    const openPhoto = client.getByRole('button', { name: 'Open photo proof.jpg', exact: true });
    await openPhoto.click();
    await expect(client.getByRole('dialog')).toBeVisible();
    await client
      .getByRole('dialog')
      .getByLabel('Compare with', { exact: true })
      .selectOption({ label: 'alternate.jpg' });
    await expect(client.locator('.viewer-stage')).toHaveClass(/is-comparing/);
    await client.getByRole('dialog').getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(
      client.getByRole('dialog').getByRole('button', { name: 'Fit to screen', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await client.getByRole('dialog').getByLabel('Compare with', { exact: true }).selectOption('');
    await client.keyboard.press('s');
    await client.keyboard.press('Escape');
    await expect(openPhoto).toBeFocused();
    await expect(
      client.getByRole('checkbox', { name: 'Selected: proof.jpg', exact: true }),
    ).toBeChecked();
    await client.getByText('proof.jpg / 0', { exact: true }).click();
    await client
      .getByLabel('General feedback', { exact: true })
      .fill('Keep the light soft around the face.');
    await client.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(
      client.getByText('Keep the light soft around the face.', { exact: false }),
    ).toBeVisible();
    await client.getByRole('button', { name: 'Annotate photo', exact: true }).click();
    await client.locator('.proofing-photo-button').focus();
    await client.keyboard.press('Enter');
    await client.getByLabel('Annotation', { exact: true }).fill('Keep this detail in the retouch.');
    await client.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(
      client.getByText('Keep this detail in the retouch.', { exact: false }),
    ).toBeVisible();
    await client.getByRole('checkbox', { name: 'Selected: proof.jpg', exact: true }).check();
    await client.getByRole('button', { name: 'With feedback', exact: true }).click();
    await expect(client.locator('.contact-frame')).toHaveCount(1);
    await client.getByRole('button', { name: 'Not selected', exact: true }).click();
    await expect(client.locator('.contact-frame')).toHaveCount(1);
    await expect(client.locator('.contact-frame')).toContainText('alternate.jpg');
    await client.getByRole('button', { name: 'All photos', exact: true }).click();
    await client.getByLabel('Find a frame', { exact: true }).fill('proof');
    await expect(client.locator('.contact-frame')).toHaveCount(1);
    await client.getByLabel('Find a frame', { exact: true }).fill('');
    const reportDownload = client.waitForEvent('download');
    await client.getByRole('button', { name: 'Export selection report', exact: true }).click();
    const report = await reportDownload;
    const reportText = readFileSync((await report.path())!, 'utf8');
    expect(reportText).toContain('proof.jpg');
    expect(reportText).toContain('Keep the light soft around the face.');
    expect(reportText).not.toContain('alternate.jpg');
    expect(reportText).not.toContain('https://');
    for (const width of [1280, 768, 375]) {
      await client.setViewportSize({ width, height: 900 });
      expect(await client.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await client.screenshot({
        path: `.artifacts/ATELIER-001-proofing-${width}.png`,
        fullPage: true,
      });
    }
    await client.setViewportSize({ width: 1280, height: 900 });
    await client.getByRole('button', { name: 'Submit selection', exact: true }).click();
    await expect(client.getByRole('button', { name: 'Submit selection', exact: true })).toHaveCount(
      0,
    );
    await manager.reload();
    await manager.getByRole('tab', { name: 'Delivery', exact: true }).click();
    await manager
      .getByLabel('Add final photos', { exact: true })
      .setInputFiles({ ...fixture, name: 'final.jpg' });
    await expect(manager.getByText('final.jpg', { exact: true })).toBeVisible();
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
