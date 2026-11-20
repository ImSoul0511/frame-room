import { expect, test } from '@playwright/test';

test('discovery keeps filters, project context and browser history in the URL', async ({
  page,
}) => {
  await page.goto('/explore?project=review-context');
  await expect(page.locator('.provider-card').first()).toBeVisible();
  await page.locator('.genre-chips').getByRole('button', { name: 'Fashion', exact: true }).click();
  await expect(page).toHaveURL(/genre=fashion/);
  await page.getByLabel('Maximum budget (VND)', { exact: true }).fill('3000000');
  await page.reload();
  await expect(page.getByLabel('Maximum budget (VND)', { exact: true })).toHaveValue('3000000');
  await expect(
    page.locator('.genre-chips').getByRole('button', { name: 'Fashion', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.provider-photo').first().click();
  await expect(page).toHaveURL(/\?project=review-context$/);
  await page.goBack();
  await expect(page).toHaveURL(/genre=fashion/);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  expect(new URL(page.url()).search).toBe('?project=review-context');
});

test('discovery retries a failed API request and explains unavailable visual search', async ({
  page,
}) => {
  await page.route('**/v1/explore?*', (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Unavailable',
          details: [{ reason: 'network_unavailable' }],
        },
      },
    }),
  );
  await page.goto('/explore');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/v1/explore?*');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('.provider-card').first()).toBeVisible();
  await page.route('**/v1/config', (route) =>
    route.fulfill({
      json: {
        data: {
          authConfigured: true,
          databaseConfigured: true,
          storageConfigured: true,
          aiConfigured: false,
          aiSearchEnabled: false,
        },
      },
    }),
  );
  await page.reload();
  await page.getByText('Find a visual match', { exact: false }).click();
  await expect(page.getByText('Visual matching is unavailable.', { exact: false })).toBeVisible();
});

test('the mobile menu is keyboard accessible and legacy booking links preserve identity', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/explore');
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(page.locator('#atelier-navigation')).toBeVisible();
  await page.goto('/bookings/live/00000000-0000-4000-8000-000000000000');
  await expect(page).toHaveURL(/\/auth\?/);
  expect(new URL(page.url()).searchParams.get('next')).toBe(
    '/bookings/00000000-0000-4000-8000-000000000000',
  );
});
