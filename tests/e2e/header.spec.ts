import { test, expect } from '@playwright/test';

test('the header hides on scroll down and returns on scroll up', async ({ page }) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await page.locator('main').evaluate((main) => {
      main.style.minHeight = '2200px';
    });
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(page.locator('.site-header-shell')).toHaveClass(/is-hidden/);
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(page.locator('.site-header-shell')).not.toHaveClass(/is-hidden/);
    await expect(page.locator('.site-header-shell .masthead')).toHaveCount(0);
  }
});

test('public navigation, footer and photographer signup use the same destinations on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page).toHaveURL(/\/home$/);
  const nav = page.locator('.primary-navigation');
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home');
  await expect(nav.getByRole('link', { name: 'Explore' })).toHaveAttribute('href', '/explore');
  await nav.getByRole('link').last().click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator('.about-story h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByRole('contentinfo').getByRole('link', { name: 'Help centre' }).click();
  await expect(page.getByRole('heading', { name: 'Help centre' })).toBeVisible();
  await page.locator('.masthead').getByRole('link', { name: 'Create account' }).click();
  await page.getByLabel('How would you like to join?').click();
  await page.getByRole('option', { name: 'Photographer', exact: true }).click();
  const choices = page.getByRole('checkbox');
  await choices.nth(1).check();
  await choices.nth(2).check();
  await expect(page.locator('.genre-choices input:checked')).toHaveCount(3);
  await choices.nth(3).check();
  await choices.nth(4).check();
  await expect(choices.nth(5)).toBeDisabled();
  await choices.nth(4).uncheck();
  await expect(choices.nth(5)).toBeEnabled();
});

test('language names stay complete and search focus shows only the caret', async ({ page }) => {
  await page.goto('/home', { waitUntil: 'domcontentloaded' });
  const language = page.getByLabel('Language', { exact: true });
  await language.click();
  await expect(page.getByRole('option')).toHaveText(['English', 'Tiếng Việt']);
  const controlBounds = await language.boundingBox();
  const popupBounds = await page.locator('.astryx-selector-popup').boundingBox();
  expect(popupBounds!.y).toBeGreaterThanOrEqual(controlBounds!.y + controlBounds!.height - 1);
  await page.keyboard.press('Escape');
  const input = page.getByRole('searchbox', { name: 'Search photographers or styles' });
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

test('avatar opens profile, keeps settings inside it and signs out', async ({ page }) => {
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
  let photographerHasCover = true;
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
  const notifications = Array.from({ length: 12 }, (_, index) => ({
    id: `notice-${index}`,
    bookingId: null,
    studioId: null,
    event: 'bookingUpdated',
    createdAt: new Date().toISOString(),
    readAt: index === 11 ? new Date().toISOString() : null,
  }));
  await page.route(`${projectUrl}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/logout')) {
      signedOut = true;
      await route.fulfill({ status: 204 });
    } else if (/\/storage\/v1\/object\/public\/(avatars|profile-covers)\//.test(path)) {
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
  await page.route('**/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/v1/me/notifications/pages') {
      const pageNumber = Number(url.searchParams.get('page'));
      const pageSize = Number(url.searchParams.get('pageSize'));
      const filtered = notifications.filter(
        (notice) => url.searchParams.get('unread') !== 'true' || !notice.readAt,
      );
      const start = (pageNumber - 1) * pageSize;
      await route.fulfill({
        json: {
          data: {
            items: filtered.slice(start, start + pageSize),
            hasMore: filtered.length > start + pageSize,
          },
        },
      });
      return;
    }
    if (path.startsWith('/v1/me/notifications/') && route.request().method() === 'PATCH') {
      const item = notifications.find((notice) => path.endsWith(notice.id));
      if (item) item.readAt = new Date().toISOString();
      await route.fulfill({ json: { data: item } });
      return;
    }
    if (path === '/v1/me' && route.request().method() === 'PATCH') {
      profileWrites++;
      const input = route.request().postDataJSON() as { displayName: string; userName: string };
      if (input.userName === 'taken_name') {
        await route.fulfill({
          status: 409,
          json: {
            error: {
              code: 'CONFLICT',
              message: 'Conflict',
              details: [{ reason: 'user_name_taken' }],
            },
          },
        });
        return;
      }
      if (input.displayName === 'Fail Check') {
        await route.fulfill({
          status: 503,
          json: {
            error: {
              code: 'UNAVAILABLE',
              message: 'Unavailable',
              details: [{ reason: 'network_unavailable' }],
            },
          },
        });
        return;
      }
      await profileWriteGate;
      account = { ...account, ...input };
      await route.fulfill({ json: { data: account } });
      return;
    }
    const data =
      path === '/v1/me'
        ? account
        : path === '/v1/me/notifications'
          ? notifications
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
                  portfolios: [
                    {
                      id: 'fallback-must-not-be-used',
                      title: 'Published album',
                      description: '',
                      genre: 'portrait',
                      ownerType: 'photographer',
                      photographerId: 'photo-id',
                      coverUrl: '/src/assets/genres/portrait.webp',
                    },
                  ],
                  services: [],
                  reviews: [],
                  coverPath: photographerHasCover ? `${userId}/cover.webp` : null,
                }
              : [];
    await route.fulfill({ json: { data } });
  });
  await page.goto('/home', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Language', { exact: true }).click();
  await page.getByRole('option', { name: 'Tiếng Việt', exact: true }).click();
  const avatar = page.locator('.site-header').getByRole('link', { name: 'Hồ sơ', exact: true });
  await page.setViewportSize({ width: 375, height: 900 });
  const avatarBounds = await avatar.boundingBox();
  expect(avatarBounds!.x).toBeGreaterThanOrEqual(0);
  expect(avatarBounds!.x + avatarBounds!.width).toBeLessThanOrEqual(375);
  await page.setViewportSize({ width: 1280, height: 900 });
  await avatar.click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.locator('.public-profile .profile-cover')).toBeVisible();
  await expect(page.locator('.public-profile h1')).toHaveText('Menu Check');
  const checkCoverDropdown = async (hasCover: boolean) => {
    const trigger = page.getByRole('button', { name: 'Đổi ảnh bìa', exact: true });
    const dropdown = page.getByRole('group', { name: 'Đổi ảnh bìa', exact: true });
    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: 900 });
      const portrait = page.locator('.account-portrait');
      const portraitBounds = await portrait.boundingBox();
      const coverBounds = await portrait.locator('.profile-cover').boundingBox();
      const identityBounds = await portrait.locator('.profile-identity').boundingBox();
      const avatarBounds = await portrait.locator('.profile-monogram').boundingBox();
      expect(Math.abs(coverBounds!.width - portraitBounds!.width)).toBeLessThanOrEqual(2);
      expect(identityBounds!.y).toBeGreaterThanOrEqual(coverBounds!.y + coverBounds!.height);
      expect(avatarBounds!.y).toBeGreaterThanOrEqual(coverBounds!.y + coverBounds!.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await portrait.screenshot({
        path: `.artifacts/profile-banner-${hasCover ? 'photographer' : 'client'}-${width}.png`,
        animations: 'disabled',
      });
      await trigger.click();
      await expect(dropdown).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const view = dropdown.getByRole('button', { name: 'Xem ảnh bìa', exact: true });
      if (hasCover) await expect(view).toBeEnabled();
      else await expect(view).toBeDisabled();
      await expect(dropdown.getByRole('button', { name: 'Chọn ảnh bìa' })).toBeVisible();
      const bounds = await dropdown.boundingBox();
      expect(bounds!.width).toBeGreaterThanOrEqual(200);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
      await page.screenshot({
        path: `.artifacts/cover-dropdown-${hasCover ? 'photographer' : 'client'}-${width}.png`,
        animations: 'disabled',
      });
      await page.keyboard.press('Escape');
      await expect(dropdown).toBeHidden();
      await expect(trigger).toBeFocused();
    }
    await trigger.click();
    if (hasCover) {
      await dropdown.getByRole('button', { name: 'Xem ảnh bìa', exact: true }).click();
      const viewer = page.getByRole('dialog', { name: 'Xem ảnh bìa', exact: true });
      await expect(viewer).toBeVisible();
      await expect(viewer.getByRole('img')).toHaveAttribute('src', /profile-covers\/.*cover\.webp/);
      await page.keyboard.press('Escape');
      await expect(viewer).toHaveCount(0);
      await trigger.click();
    }
    const picker = page.waitForEvent('filechooser');
    await dropdown.getByRole('button', { name: 'Chọn ảnh bìa' }).click();
    await (await picker).setFiles('apps/web/src/assets/genres/portrait.webp');
    await expect(dropdown).toBeHidden();
    const editor = page.getByRole('dialog', { name: 'Đổi ảnh bìa', exact: true });
    await expect(editor).toBeVisible();
    const stage = editor.locator('.cover-crop-stage');
    await expect(stage.locator('img')).toHaveAttribute('src', /^blob:/);
    await expect(editor.getByRole('button', { name: 'Dùng ảnh này' })).toBeEnabled();
    const bounds = (await stage.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.7);
    await page.mouse.up();
    await expect(editor.locator('input[type="range"]').last()).not.toHaveValue('0');
    const replacement = page.waitForEvent('filechooser');
    await editor.getByRole('button', { name: 'Chọn ảnh bìa', exact: true }).click();
    await (await replacement).setFiles([]);
    await expect(stage.locator('img')).toHaveAttribute('src', /^blob:/);
    await editor.getByRole('button', { name: 'Hủy', exact: true }).click();
    await expect(editor).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 900 });
  };
  await checkCoverDropdown(false);
  const profileTabs = page.getByRole('navigation', { name: 'Hồ sơ', exact: true });
  await expect(profileTabs.getByRole('link', { name: 'Hồ sơ', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await profileTabs.getByRole('link', { name: 'Thông báo', exact: true }).click();
  await expect(page.locator('.notification-card')).toHaveCount(10);
  await page.getByRole('button', { name: 'Trang tiếp theo' }).click();
  await expect(page.locator('.notification-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Chưa đọc', exact: true }).click();
  await expect(page.locator('.notification-card')).toHaveCount(10);
  await page.getByRole('button', { name: 'Trang tiếp theo' }).click();
  await expect(page.locator('.notification-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).click();
  await expect(page.locator('.notification-card')).toHaveCount(10);
  await expect(page.getByRole('textbox', { name: /^Tên hiển thị/ })).toHaveCount(0);
  await profileTabs.getByRole('link', { name: 'Cài đặt', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('textbox', { name: /^Tên hiển thị/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Tên người dùng/ })).toBeVisible();
  const name = page.getByRole('textbox', { name: /^Tên hiển thị/ });
  const username = page.getByRole('textbox', { name: /^Tên người dùng/ });
  const save = page.getByRole('button', { name: 'Lưu thay đổi', exact: true });
  const cancel = page.getByRole('button', { name: 'Hủy', exact: true });
  await expect(name).toBeEnabled();
  await expect(username).toBeEnabled();
  await expect(name).toHaveValue('Menu Check');
  await expect(username).toHaveValue('menu_check');
  await expect(save).toBeDisabled();
  await expect(cancel).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Email đăng nhập' })).toBeVisible();
  await expect(page.locator('.settings-signin-email')).toHaveText(user.email);
  await name.fill('Discard this');
  await username.fill('discard_this');
  await expect(save).toBeEnabled();
  await cancel.click();
  await expect(name).toHaveValue('Menu Check');
  await expect(username).toHaveValue('menu_check');
  await expect(save).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Chọn ảnh đại diện' })).toHaveCount(0);
  await page.locator('.settings-avatar-card-photo').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Điều chỉnh ảnh đại diện' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xem ảnh đại diện' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Chọn ảnh đại diện' })).toBeVisible();
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Chọn ảnh đại diện' }).click();
  await (
    await picker
  ).setFiles({
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
  await name.fill(' '.repeat(3));
  await save.click();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toBeFocused();
  expect(profileWrites).toBe(0);
  await name.fill('x'.repeat(61));
  await save.click();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  expect(profileWrites).toBe(0);
  await name.fill('Menu Check');
  await username.fill('_invalid');
  await save.click();
  await expect(username).toHaveAttribute('aria-invalid', 'true');
  await expect(username).toBeFocused();
  expect(profileWrites).toBe(0);
  await username.fill('taken_name');
  await save.click();
  await expect.poll(() => profileWrites).toBe(1);
  await expect(username).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.settings-profile-panel')).toContainText(
    'Tên người dùng đã được sử dụng.',
  );
  await expect(username).toHaveValue('taken_name');
  await expect(avatar.locator('.user-avatar')).toHaveText('MC');
  await username.fill('New_Check');
  await name.fill('Fail Check');
  await save.click();
  await expect.poll(() => profileWrites).toBe(2);
  await expect(page.locator('.settings-profile-panel').getByRole('alert')).toBeVisible();
  await expect(name).toHaveValue('Fail Check');
  await expect(username).toHaveValue('New_Check');
  await expect(avatar.locator('.user-avatar')).toHaveText('MC');
  await name.fill('New Check');
  await username.press('Enter');
  await expect.poll(() => profileWrites).toBe(3);
  await expect(name).toBeDisabled();
  await expect(username).toBeDisabled();
  await expect(save).toBeDisabled();
  await expect(avatar.locator('.user-avatar')).toHaveText('MC');
  await expect(page.locator('.settings-profile-panel .notice.success')).toHaveCount(0);
  releaseProfileWrite?.();
  await expect(avatar.locator('.user-avatar')).toHaveText('NC');
  await expect(page.locator('.settings-profile-panel .notice.success')).toHaveText('Đã lưu');
  await expect(save).toBeDisabled();
  await expect(name).toBeEnabled();
  await expect(username).toBeEnabled();
  await expect(username).toHaveValue('new_check');
  await expect(page.locator('.settings-avatar-card-username')).toHaveText('@new_check');
  await name.fill('Another draft');
  await cancel.click();
  await expect(name).toHaveValue('New Check');
  await expect(page.locator('.settings-profile-panel .notice.success')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Hồ sơ nhiếp ảnh gia' })).toHaveCount(0);
  await expect(profileTabs.getByRole('link', { name: 'Cài đặt' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('textbox', { name: /^Tên hiển thị/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đổi mật khẩu' })).toBeVisible();
  await expect(page.locator('.settings-language-panel').getByLabel('Ngôn ngữ')).toBeVisible();
  await expect(page.locator('.site-header a[href="/settings"]')).toHaveCount(0);
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const saveBounds = await save.boundingBox();
    expect(saveBounds!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.screenshot({
      path: `.artifacts/profile-settings-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page.reload();
  await expect(name).toHaveValue('New Check');
  await expect(username).toHaveValue('new_check');
  await page.setViewportSize({ width: 1280, height: 900 });
  account = { ...account, roles: ['client', 'photographer'], avatarPath: `${userId}/avatar.webp` };
  await page.goto('/profile');
  await page.reload();
  await expect(page.locator('.public-profile h1')).toHaveText('New Check');
  await expect(page.locator('.public-profile .profile-monogram img')).toHaveAttribute(
    'src',
    /avatar\.webp/,
  );
  await expect(page.getByRole('button', { name: 'Đổi ảnh bìa', exact: true })).toBeAttached();
  photographerHasCover = false;
  await page.reload();
  await expect(page.locator('.account-portrait .profile-cover')).toHaveClass(/profile-cover-empty/);
  await expect(page.locator('.account-portrait .profile-cover img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Đổi ảnh bìa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Xem ảnh bìa', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  photographerHasCover = true;
  await page.reload();
  await checkCoverDropdown(true);
  await page.getByRole('button', { name: 'Điều chỉnh ảnh đại diện', exact: true }).click();
  const photoMenu = page.getByRole('group', { name: 'Điều chỉnh ảnh đại diện', exact: true });
  await expect(photoMenu).toBeVisible();
  await photoMenu.getByRole('button', { name: 'Xem ảnh đại diện', exact: true }).click();
  const photoViewer = page.getByRole('dialog', { name: 'Xem ảnh đại diện', exact: true });
  await expect(photoViewer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(photoViewer).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Liên hệ', exact: true })).toHaveCount(0);
  await expect(page.locator('.primary-navigation > a')).toHaveText([
    'Trang chủ',
    'Dự án của bạn',
    'Lịch chụp',
    'Hồ sơ và tác phẩm',
    'Giới thiệu',
  ]);
  await expect(profileTabs.getByRole('link')).toHaveText([
    'Hồ sơ',
    'Studio',
    'Lịch chụp',
    'Dự án của bạn',
    'Hồ sơ và tác phẩm',
    'Thông báo',
    'Cài đặt',
  ]);
  await expect(profileTabs.locator('.photographer-logout-box')).toBeVisible();
  const contentBounds = await page.locator('.photographer-account-content').boundingBox();
  const sidebarBounds = await page.locator('.photographer-account-sidebar').boundingBox();
  expect(contentBounds!.x).toBeGreaterThanOrEqual(sidebarBounds!.x + sidebarBounds!.width);
  const headerBounds = await page.locator('.site-header-shell').boundingBox();
  const backBounds = await page.locator('.detail-back').boundingBox();
  expect(sidebarBounds!.y).toBeGreaterThanOrEqual(backBounds!.y + backBounds!.height);
  await page.locator('.photographer-account-content').evaluate((content) => {
    (content as HTMLElement).style.minHeight = '2200px';
  });
  await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'instant' }));
  await expect
    .poll(async () => (await page.locator('.photographer-account-sidebar').boundingBox())?.y)
    .toBeCloseTo(12, 0);
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
  await expect
    .poll(async () => (await page.locator('.photographer-account-sidebar').boundingBox())?.y)
    .toBeCloseTo(headerBounds!.height + 12, 0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.setViewportSize({ width: 375, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(profileTabs.getByRole('link', { name: 'Hồ sơ', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await profileTabs.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Đăng nhập', exact: true })).toBeVisible();
  expect(signedOut).toBe(true);
});

test('provider and portfolio photos fit their frames', async ({ page, request }) => {
  await expect(async () => {
    const health = await request.get('http://localhost:4000/health');
    expect(health.ok()).toBe(true);
  }).toPass({ timeout: 15000 });
  await page.setViewportSize({ width: 1280, height: 900 });
  const response = await request.get('http://localhost:4000/v1/portfolios?pageSize=1');
  expect(response.ok()).toBe(true);
  const { data } = await response.json();
  test.skip(!data.length, 'Requires at least one published portfolio.');
  const portfolio = data[0];
  await page.goto(
    `/providers/${portfolio.ownerType}/${portfolio.photographerId ?? portfolio.studioId}`,
    { waitUntil: 'domcontentloaded' },
  );
  const cover = page.locator('.profile-cover img');
  const detailResponse = await request.get(
    `http://localhost:4000/v1/${portfolio.ownerType === 'photographer' ? 'photographers' : 'studios'}/${portfolio.photographerId ?? portfolio.studioId}`,
  );
  expect(detailResponse.ok()).toBe(true);
  const { data: detail } = await detailResponse.json();
  if (detail.coverPath) {
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
  } else {
    await expect(page.locator('.profile-cover')).toHaveClass(/profile-cover-empty/);
    await expect(cover).toHaveCount(0);
  }
  await page.screenshot({ path: '.artifacts/profile-cover-fit.png', animations: 'disabled' });
  await page.goto(`/portfolios/${portfolio.id}`, { waitUntil: 'domcontentloaded' });
  const photo = page.locator('.media-card img').first();
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
      frame: image.closest('.media-card-image')!.clientWidth,
    };
  });
  expect(photoSizes.width).toBeLessThanOrEqual(480);
  expect(photoSizes.height).toBeLessThanOrEqual(280);
  expect(photoSizes.ratio).toBeCloseTo(photoSizes.natural, 2);
  expect(Math.abs(photoSizes.width - photoSizes.frame)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: '.artifacts/gallery-fit.png', animations: 'disabled' });
});
