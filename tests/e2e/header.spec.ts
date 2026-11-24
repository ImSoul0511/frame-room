import { test, expect } from '@playwright/test';

test('the masthead and navigation remain visible while scrolling', async ({ page }) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/explore', { waitUntil: 'domcontentloaded' });
    await page.locator('main').evaluate((main) => {
      main.style.minHeight = '2200px';
    });
    await page.evaluate(() => window.scrollTo(0, 600));
    const masthead = await page.locator('.site-header').boundingBox();
    const navigation = await page.locator('.navigation-bar').boundingBox();
    expect(masthead!.y).toBeGreaterThanOrEqual(0);
    expect(masthead!.y).toBeLessThanOrEqual(1);
    expect(navigation!.y).toBeGreaterThanOrEqual(masthead!.y + masthead!.height - 1);
    expect(navigation!.y + navigation!.height).toBeLessThan(900);
  }
});

test('language names stay complete and search focus shows only the caret', async ({ page }) => {
  await page.goto('/explore', { waitUntil: 'domcontentloaded' });
  const language = page.getByLabel('Language', { exact: true });
  await language.click();
  await expect(page.getByRole('option')).toHaveText(['English', 'Tiếng Việt']);
  const controlBounds = await language.boundingBox();
  const popupBounds = await page.locator('.astryx-selector-popup').boundingBox();
  expect(popupBounds!.y).toBeGreaterThanOrEqual(controlBounds!.y + controlBounds!.height - 1);
  await page.keyboard.press('Escape');
  const input = page.getByRole('searchbox', { name: 'Search by username' });
  await input.click();
  await expect(input).toBeFocused();
  expect(
    await input.evaluate((node) => ({
      outline: getComputedStyle(node).outlineStyle,
      shadow: getComputedStyle(node).boxShadow,
    })),
  ).toEqual({ outline: 'none', shadow: 'none' });
  await input.fill('photo');
  expect(await input.evaluate((node) => (node as HTMLInputElement).selectionStart)).toBe(5);
  await language.click();
  await page.getByRole('option', { name: 'Tiếng Việt', exact: true }).click();
  await expect(page.getByLabel('Ngôn ngữ', { exact: true })).toContainText('Tiếng Việt');
  await page.setViewportSize({ width: 375, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: '.artifacts/header-language-mobile.png', animations: 'disabled' });
});

test('avatar menu opens profile, keeps settings inside it and signs out', async ({ page }) => {
  const projectUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  test.skip(
    !projectUrl,
    'Requires the configured public Auth client; all account requests are isolated fixtures.',
  );
  const userId = '11111111-1111-4111-8111-111111111111';
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: userId,
    email: 'menu-check@example.test',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'email' },
    user_metadata: { registration_role: 'client' },
    created_at: new Date().toISOString(),
    email_confirmed_at: new Date().toISOString(),
  };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, aud: 'authenticated', role: 'authenticated', exp: now + 3600, iat: now })}.isolated-test-signature`;
  const storageKey = `sb-${new URL(projectUrl!).hostname.split('.')[0]}-auth-token`;
  await page.addInitScript(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    {
      key: storageKey,
      session: {
        access_token: token,
        refresh_token: 'isolated-test-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        user,
      },
    },
  );
  let signedOut = false;
  let profileWrites = 0;
  let releaseProfileWrite: (() => void) | undefined;
  const profileWriteGate = new Promise<void>((resolve) => {
    releaseProfileWrite = resolve;
  });
  let account = {
    id: userId,
    userName: 'menu_check',
    displayName: 'Menu Check',
    avatarPath: null as string | null,
    roles: ['client'],
    createdAt: new Date().toISOString(),
  };
  await page.route(`${projectUrl}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/logout')) {
      signedOut = true;
      await route.fulfill({ status: 204 });
    } else if (path.includes('/storage/v1/object/public/avatars/')) {
      await route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a1sAAAAASUVORK5CYII=',
          'base64',
        ),
      });
    } else if (path.endsWith('/user')) await route.fulfill({ json: user });
    else await route.abort();
  });
  await page.route('http://localhost:4000/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/v1/me' && route.request().method() === 'PATCH') {
      profileWrites++;
      const input = route.request().postDataJSON() as { displayName: string; userName: string };
      await profileWriteGate;
      account = { ...account, ...input };
      await route.fulfill({ json: { data: account } });
      return;
    }
    const data =
      path === '/v1/me'
        ? account
        : path === '/v1/photographers/me'
          ? account.roles.includes('photographer')
            ? { id: 'photo-id' }
            : null
          : path === '/v1/photographers/photo-id'
            ? {
                provider: {
                  id: 'photo-id',
                  type: 'photographer',
                  displayName: 'New Check',
                  city: '',
                  district: '',
                  bio: '',
                  genres: ['portrait'],
                  styles: [],
                  priceFrom: null,
                  ratingAvg: null,
                  reviewCount: 0,
                },
                portfolios: [],
                services: [],
                reviews: [],
              }
            : [];
    await route.fulfill({ json: { data } });
  });
  await page.goto('/explore', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Language', { exact: true }).click();
  await page.getByRole('option', { name: 'Tiếng Việt', exact: true }).click();
  const avatar = page.getByRole('button', { name: 'Menu tài khoản', exact: true });
  await avatar.click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem')).toHaveText(['Hồ sơ', 'Đăng xuất']);
  await page.screenshot({ path: '.artifacts/avatar-menu.png', animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).not.toBeVisible();
  await expect(avatar).toBeFocused();
  await page.setViewportSize({ width: 375, height: 900 });
  await avatar.click();
  const menuBounds = await page.getByRole('menu').boundingBox();
  expect(menuBounds!.x).toBeGreaterThanOrEqual(0);
  expect(menuBounds!.x + menuBounds!.width).toBeLessThanOrEqual(375);
  await page.screenshot({ path: '.artifacts/avatar-menu-mobile.png', animations: 'disabled' });
  await page.getByRole('link', { name: 'FrameRoom', exact: true }).click();
  await expect(page.getByRole('menu')).not.toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await avatar.press('ArrowDown');
  await page.getByRole('menuitem', { name: 'Hồ sơ', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.locator('.public-profile .profile-cover')).toBeVisible();
  await expect(page.locator('.public-profile h1')).toHaveText('Menu Check');
  const profileTabs = page.getByRole('navigation', { name: 'Hồ sơ', exact: true });
  await expect(profileTabs.getByRole('link', { name: 'Hồ sơ' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByLabel('Tên hiển thị', { exact: true })).toHaveCount(0);
  await profileTabs.getByRole('link', { name: 'Cài đặt', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByLabel('Tên hiển thị', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Tên người dùng', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Tên hiển thị', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Tên người dùng', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Chọn ảnh đại diện' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cập nhật', exact: true }).click();
  await expect(page.getByLabel('Tên hiển thị', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('Tên người dùng', { exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Xác nhận', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chọn ảnh đại diện' })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a1sAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.getByRole('dialog', { name: 'Điều chỉnh ảnh đại diện' })).toBeVisible();
  await expect(page.getByLabel('Thu phóng')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(profileWrites).toBe(0);
  await page.getByLabel('Tên hiển thị', { exact: true }).fill('New Check');
  expect(profileWrites).toBe(0);
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect.poll(() => profileWrites).toBe(1);
  await expect(avatar.locator('.user-avatar')).toHaveText('NC');
  await expect(page.locator('.profile-update-confirmed')).toBeVisible();
  releaseProfileWrite?.();
  await expect(page.getByRole('button', { name: 'Cập nhật', exact: true })).toBeEnabled();
  await expect(page.locator('.profile-update-confirmed')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hồ sơ nhiếp ảnh gia' })).toHaveCount(0);
  await expect(profileTabs.getByRole('link', { name: 'Cài đặt' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByLabel('Tên hiển thị', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Quên mật khẩu?' })).toBeVisible();
  await expect(page.locator('.settings-language-panel').getByLabel('Ngôn ngữ')).toBeVisible();
  await expect(page.locator('.site-header a[href="/settings"]')).toHaveCount(0);
  await page.screenshot({ path: '.artifacts/profile-settings.png', animations: 'disabled' });
  account = { ...account, roles: ['client', 'photographer'], avatarPath: `${userId}/avatar.webp` };
  await page.goto('/profile');
  await page.reload();
  await expect(page.locator('.public-profile h1')).toHaveText('New Check');
  await expect(page.locator('.public-profile .profile-monogram img')).toHaveAttribute(
    'src',
    /avatar\.webp/,
  );
  await expect(page.getByLabel('Đổi ảnh bìa')).toBeAttached();
  await expect(page.getByRole('button', { name: 'Liên hệ', exact: true })).toHaveCount(0);
  await expect(profileTabs.getByRole('link', { name: 'Hồ sơ' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await avatar.click();
  await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Đăng nhập', exact: true })).toBeVisible();
  expect(signedOut).toBe(true);
});

test('photo frames follow the natural image ratio', async ({ page, request }) => {
  await expect(async () => {
    const health = await request.get('http://localhost:4000/health');
    expect(health.ok()).toBe(true);
  }).toPass({ timeout: 15000 });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/explore', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.story-frame img').first()).toBeAttached({ timeout: 15000 });
  for (const image of await page.locator('.story-frame img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth), {
        timeout: 15000,
      })
      .toBeGreaterThan(0);
    const sizes = await image.evaluate((node) => {
      const photo = node as HTMLImageElement;
      const frame = photo.closest('.story-frame')!;
      const style = getComputedStyle(frame);
      return {
        ratio: photo.clientWidth / photo.clientHeight,
        natural: photo.naturalWidth / photo.naturalHeight,
        width: photo.clientWidth,
        height: photo.clientHeight,
        emptyWidth:
          frame.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight) -
          photo.clientWidth,
      };
    });
    expect(sizes.ratio).toBeCloseTo(sizes.natural, 2);
    expect(sizes.width).toBeLessThanOrEqual(440);
    expect(sizes.height).toBeLessThanOrEqual(420);
    expect(Math.abs(sizes.emptyWidth)).toBeLessThanOrEqual(2);
  }
  await page
    .locator('.genre-stories')
    .screenshot({ path: '.artifacts/story-frames.png', animations: 'disabled' });
  const response = await request.get('http://localhost:4000/v1/portfolios?pageSize=1');
  expect(response.ok()).toBe(true);
  const { data } = await response.json();
  const portfolio = data[0];
  await page.goto(
    `/providers/${portfolio.ownerType}/${portfolio.photographerId ?? portfolio.studioId}`,
    { waitUntil: 'domcontentloaded' },
  );
  const cover = page.locator('.profile-cover img');
  await expect
    .poll(() => cover.evaluate((node) => (node as HTMLImageElement).naturalWidth), {
      timeout: 15000,
    })
    .toBeGreaterThan(0);
  await expect(cover).toBeVisible();
  const coverSizes = await cover.evaluate((node) => ({
    image: node.clientWidth,
    frame: node.closest('.profile-cover')!.clientWidth,
    height: node.clientHeight,
  }));
  expect(Math.abs(coverSizes.image - coverSizes.frame)).toBeLessThanOrEqual(2);
  expect(coverSizes.image).toBeLessThanOrEqual(960);
  expect(coverSizes.height).toBeLessThanOrEqual(340);
  await page.screenshot({ path: '.artifacts/profile-cover-fit.png', animations: 'disabled' });
  await page.goto(`/portfolios/${portfolio.id}`, { waitUntil: 'domcontentloaded' });
  const photo = page.locator('.gallery-photo img').first();
  await photo.scrollIntoViewIfNeeded();
  await expect
    .poll(() => photo.evaluate((node) => (node as HTMLImageElement).naturalWidth), {
      timeout: 15000,
    })
    .toBeGreaterThan(0);
  const photoSizes = await photo.evaluate((node) => {
    const image = node as HTMLImageElement;
    return {
      width: image.clientWidth,
      height: image.clientHeight,
      ratio: image.clientWidth / image.clientHeight,
      natural: image.naturalWidth / image.naturalHeight,
      frame: image.closest('.gallery-photo')!.clientWidth,
    };
  });
  expect(photoSizes.width).toBeLessThanOrEqual(480);
  expect(photoSizes.height).toBeLessThanOrEqual(420);
  expect(photoSizes.ratio).toBeCloseTo(photoSizes.natural, 2);
  expect(Math.abs(photoSizes.width - photoSizes.frame)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: '.artifacts/gallery-fit.png', animations: 'disabled' });
});
