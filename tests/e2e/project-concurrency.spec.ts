import { test, expect, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/auth');
  await page.getByLabel(/^Email/).fill(process.env.FRAME_ROOM_E2E_CLIENT_EMAIL!);
  await page.getByLabel(/^Password/).fill(process.env.FRAME_ROOM_E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

test('concurrent project edits retain the draft and successive brief saves use the new version', async ({
  browser,
}) => {
  const local =
    process.env.FRAME_ROOM_E2E_LOCAL_PROJECT === 'frameroom-atelier-verification' &&
    process.env.VITE_SUPABASE_URL === 'http://127.0.0.1:56321' &&
    Boolean(process.env.DATABASE_URL?.includes('@127.0.0.1:56322/'));
  const cloud = Boolean(
    process.env.CLOUD_TEST_PROJECT_REF &&
    process.env.CLOUD_TEST_DATABASE_URL &&
    process.env.DATABASE_URL === process.env.CLOUD_TEST_DATABASE_URL &&
    process.env.VITE_SUPABASE_URL === `https://${process.env.CLOUD_TEST_PROJECT_REF}.supabase.co`,
  );
  test.skip(
    !(local || cloud) || !process.env.FRAME_ROOM_E2E_PASSWORD,
    'Requires a designated disposable database and synthetic client.',
  );
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();
  try {
    await signIn(first);
    await signIn(second);
    await first.getByRole('button', { name: 'Start an idea', exact: true }).click();
    const title = `Concurrent project ${Date.now()}`;
    await first.getByLabel(/^Project name/).fill(title);
    await first.getByLabel('Describe your idea', { exact: true }).fill('Original idea');
    await first.getByRole('button', { name: 'Create project', exact: true }).click();
    await expect(first).toHaveURL(/\/projects\/[a-f0-9-]+/);
    const destination = new URL(first.url()).pathname;
    await second.goto(destination);
    await first.getByRole('button', { name: 'Edit the idea', exact: true }).click();
    await first.getByLabel('Describe your idea', { exact: true }).fill('My unsaved draft');
    await second.getByRole('button', { name: 'Edit the idea', exact: true }).click();
    await second
      .getByLabel('Describe your idea', { exact: true })
      .fill('The other session saved this');
    await second.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(second.getByRole('button', { name: 'Edit the idea', exact: true })).toBeVisible();
    await first.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(first.getByText('Someone updated this content.', { exact: false })).toBeVisible();
    await expect(first.getByLabel('Describe your idea', { exact: true })).toHaveValue(
      'My unsaved draft',
    );
    await expect(first.locator('.atelier-idea-card blockquote')).toHaveText(
      'The other session saved this',
    );
    await first.getByRole('button', { name: 'Load latest version', exact: true }).click();
    await first.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(first.getByRole('button', { name: 'Edit the idea', exact: true })).toBeVisible();
    await second.reload();
    await expect(second.locator('.atelier-idea-card')).toContainText('My unsaved draft');
    await first.getByRole('button', { name: 'Shoot agreement', exact: true }).click();
    for (const concept of ['First saved brief', 'Second saved brief']) {
      await first.getByLabel('Overall concept', { exact: true }).fill(concept);
      const response = first.waitForResponse(
        (res) => res.request().method() === 'PATCH' && res.url().includes('/v1/creative-projects/'),
      );
      await first.getByRole('button', { name: 'Save draft', exact: true }).click();
      expect((await response).status()).toBe(200);
      await expect(first.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled();
    }
    await first.reload();
    await first.getByRole('button', { name: 'Shoot agreement', exact: true }).click();
    await expect(first.getByLabel('Overall concept', { exact: true })).toHaveValue(
      'Second saved brief',
    );
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});
