import { test, expect } from '@playwright/test';

for (const width of [1280, 375]) {
  test(`individual photos and tag popup at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('frameroom.language', 'en'));
    const requests: URLSearchParams[] = [];
    await page.route('**/v1/tags', (route) =>
      route.fulfill({
        json: { data: [{ id: 'soft', name: 'Soft light', slug: 'soft', kind: 'mood' }] },
      }),
    );
    await page.route('**/v1/photos?*', (route) => {
      requests.push(new URL(route.request().url()).searchParams);
      return route.fulfill({
        json: {
          data: [0, 1, 2].map((index) => ({
            id: `photo-${index}`,
            portfolioId: 'same-album',
            caption: `Portrait ${index}`,
            url: '/src/assets/genres/portrait.webp',
            tags: [],
          })),
        },
      });
    });
    await page.route('**/v1/portfolios/same-album', (route) =>
      route.fulfill({
        json: {
          data: {
            portfolio: {
              id: 'same-album',
              title: 'Window stories',
              description: 'Portraits in natural light.',
              ownerName: 'Mai',
              ownerType: 'photographer',
              photographerId: 'mai',
              studioId: null,
              genre: 'portrait',
              status: 'published',
            },
            images: [0, 1, 2].map((index) => ({
              id: `photo-${index}`,
              caption: `Portrait ${index}`,
              url: '/src/assets/genres/portrait.webp',
              tags: [],
              width: 800,
              height: 1200,
              crewCredits: 'Photography by Mai',
            })),
          },
        },
      }),
    );
    await page.goto('/inspiration');
    const providerId = '11111111-1111-4111-8111-111111111111';
    await page.route('**/v1/photographers/by-username?*', (route) =>
      route.fulfill({
        json: {
          data: {
            userName: 'mai',
            provider: {
              id: providerId,
              type: 'photographer',
              displayName: 'Mai',
              city: 'Hồ Chí Minh',
              district: '',
              genres: ['portrait'],
              styles: [],
              bio: 'Portrait photography',
              priceFrom: null,
              ratingAvg: null,
              reviewCount: 0,
            },
            services: [],
            portfolios: [],
            reviews: [],
          },
        },
      }),
    );
    await page.route('**/availability?*', (route) =>
      route.fulfill({ json: { data: { availabilityPublic: false, slots: [] } } }),
    );
    const photos = page.locator('.discovery-photo');
    await expect(photos).toHaveCount(3);
    await expect(photos.first()).toHaveCSS('border-top-width', '0px');
    const controls = await Promise.all([
      page.locator('.photo-genre-filter').boundingBox(),
      page.locator('.tag-filter-trigger').boundingBox(),
      page.locator('.collection-toolbar > .fr-selector-field').boundingBox(),
    ]);
    // All three controls share the same baseline, including narrow screens.
    const bottoms = controls.map((box) => box!.y + box!.height);
    expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThan(2);
    await page.getByRole('button', { name: /Filter by tag/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Soft light', exact: true }).click();
    await expect.poll(() => requests.at(-1)?.get('tags')).toBe('soft');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect(dialog).toHaveCount(0);
    await page.getByLabel('Sort by', { exact: true }).click();
    await page.getByRole('option', { name: /Oldest/ }).click();
    await expect.poll(() => requests.at(-1)?.get('sort')).toBe('oldest');
    await photos.first().click();
    await expect(page).toHaveURL(/\/portfolios\/same-album\/photos\/photo-0$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.photo-detail-visual img')).toHaveAttribute('src', /portrait.webp/);
    await expect(page.locator('.photo-detail-copy h1')).toHaveText('Portrait 0');
    await expect(page.locator('.photo-detail-copy')).not.toContainText('Dimensions');
    await expect(page.locator('.photo-detail-album')).toContainText('Window stories');
    await expect(page.locator('.photo-detail-album a').last()).toHaveAttribute(
      'href',
      '/portfolios/same-album',
    );
    await page.reload();
    await expect(page.locator('.photo-detail-copy h1')).toHaveText('Portrait 0');
    await page.screenshot({ path: `.artifacts/photo-detail-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.goto('/inspiration');
    await expect(photos).toHaveCount(3);
    await page.screenshot({ path: `.artifacts/photo-discovery-${width}.png`, fullPage: true });
    await page.goto('/genres/portrait');
    await page.locator('.search-start').scrollIntoViewIfNeeded();
    await expect(photos).toHaveCount(3);
    await expect.poll(() => requests.at(-1)?.get('genre')).toBe('portrait');
    await page.goto('/explore?mode=style');
    await expect(photos).toHaveCount(3);
    await page.getByLabel('Sort by', { exact: true }).click();
    await page.getByRole('option', { name: /Oldest/ }).click();
    await expect.poll(() => requests.at(-1)?.get('sort')).toBe('oldest');
    await page.goto('/providers/photographer/mai');
    await expect(page.locator('.profile-main .discovery-photo')).toHaveCount(3);
    await expect.poll(() => requests.at(-1)?.get('photographerId')).toBe(providerId);
    await expect(page.getByRole('heading', { name: 'Availability', exact: true })).toBeVisible();
    await expect(
      page.getByText(
        'This photographer has not shared their availability. Get in touch to arrange a suitable time.',
      ),
    ).toBeVisible();
  });
}
