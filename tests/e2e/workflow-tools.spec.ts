import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Booking } from '@frameroom/shared';

const configured =
  process.env.FRAME_ROOM_E2E_LOCAL_PROJECT === 'frameroom-atelier-verification' &&
  process.env.VITE_SUPABASE_URL === 'http://127.0.0.1:56321';
async function login(page: Page) {
  await page.goto('/auth');
  await page.getByLabel(/^Email/).fill(process.env.FRAME_ROOM_E2E_CLIENT_EMAIL!);
  await page.getByLabel(/^Password/).fill(process.env.FRAME_ROOM_E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

test('saved perspectives persist through refresh and can be removed', async ({ page }) => {
  test.skip(!configured, 'Requires the designated disposable local project.');
  await login(page);
  await page.goto('/explore?project=saved-context');
  const card = page.locator('.provider-card').filter({ hasText: 'Still Studio' });
  const remove = card.getByRole('button', {
    name: 'Remove saved provider: Still Studio',
    exact: true,
  });
  await expect(card.locator('.save-provider-button')).toBeEnabled();
  if (await remove.count()) await remove.click();
  const other = await page.context().newPage();
  await other.goto('/explore');
  const otherSave = other.getByRole('button', { name: 'Save provider: Still Studio', exact: true });
  await expect(otherSave).toBeEnabled();
  const responses = [page, other].map((tab) =>
    tab.waitForResponse(
      (response) =>
        response.url().endsWith('/v1/me/saved-providers') && response.request().method() === 'POST',
    ),
  );
  await Promise.all([
    card.getByRole('button', { name: 'Save provider: Still Studio', exact: true }).click(),
    otherSave.click(),
  ]);
  const records = await Promise.all(
    responses.map(async (response) => (await (await response).json()).data.id as string),
  );
  expect(records[0]).toBe(records[1]);
  await other.close();
  await expect(remove).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'View saved providers', exact: true }).click();
  await expect(page).toHaveURL(/\/saved\?project=saved-context$/);
  await page.reload();
  await expect(page.locator('.provider-card').filter({ hasText: 'Still Studio' })).toBeVisible();
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.screenshot({ path: `.artifacts/ATELIER-002-saved-${width}.png`, fullPage: true });
  }
  await page
    .getByRole('button', { name: 'Remove saved provider: Still Studio', exact: true })
    .click();
  await expect(page.locator('.provider-card').filter({ hasText: 'Still Studio' })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.provider-card').filter({ hasText: 'Still Studio' })).toHaveCount(0);
});

test('calendar exports authorized shoots and a printable agreed brief', async ({ page }) => {
  test.skip(!configured, 'Requires the designated disposable local project.');
  await login(page);
  const response = page.waitForResponse(
    (response) => response.url().endsWith('/v1/bookings') && response.ok(),
  );
  await page.goto('/bookings');
  const bookings = (await (await response).json()).data as Booking[];
  const booking = bookings.find((item) => item.agreedBriefVersion !== null)!;
  expect(booking).toBeTruthy();
  await page.goto('/calendar');
  await expect(page.getByRole('grid')).toBeVisible();
  await page.getByLabel('Month', { exact: true }).fill(booking.scheduledStart.slice(0, 7));
  await page.getByRole('button', { name: 'All shoots', exact: true }).click();
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await expect(page.locator(`.calendar-agenda a[href="/bookings/${booking.id}"]`)).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export calendar', exact: true }).click();
  const download = await downloaded;
  const content = await readFile((await download.path())!, 'utf8');
  expect(content).toContain(`UID:${booking.id}@frameroom`);
  expect(content).toContain('BEGIN:VCALENDAR');
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Month', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.screenshot({ path: `.artifacts/ATELIER-002-calendar-${width}.png`, fullPage: true });
  }
  await page.locator('.calendar-day[tabindex="0"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.calendar-day[tabindex="0"]')).toBeFocused();
  await page.goto(`/bookings/${booking.id}/brief`);
  await expect(page.locator('.print-brief')).toContainText('Agreed version');
  await expect(page.locator('.print-brief')).toContainText(booking.id);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: '.artifacts/ATELIER-002-brief-375.png', fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.brief-print-toolbar')).toBeHidden();
  await expect(page.locator('.atelier-header')).toBeHidden();
  await expect(page.locator('.print-brief')).toBeVisible();
  await page.pdf({ path: '.artifacts/ATELIER-002-shoot-brief.pdf', preferCSSPageSize: true });
});

test('notification triage persists read state and protects unsigned routes', async ({ page }) => {
  test.skip(!configured, 'Requires the designated disposable local project.');
  await page.goto('/saved');
  await expect(page).toHaveURL(/\/auth\?/);
  expect(new URL(page.url()).searchParams.get('next')).toBe('/saved');
  await login(page);
  await page.goto('/notifications');
  await page.getByRole('button', { name: 'Unread', exact: true }).click();
  const all = page.getByRole('button', { name: 'Mark all as read', exact: true });
  await expect(all).toBeVisible();
  if (await all.isEnabled()) await all.click();
  await expect(page.locator('.notification-toolbar [role="status"]')).toHaveText('0 Unread');
  await expect(page.getByText('You’re all caught up.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.notification-toolbar [role="status"]')).toHaveText('0 Unread');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: '.artifacts/ATELIER-002-notifications-375.png', fullPage: true });
});
