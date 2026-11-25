import { expect, test } from '@playwright/test';

const album = {
  id: 'compact-album',
  title: 'Quiet afternoon',
  description: 'Soft light and a quiet afternoon by the window.',
  genre: 'portrait',
  ownerType: 'photographer',
  photographerId: 'compact-person',
  ownerName: 'Linh Nguyen',
  coverUrl: '/src/assets/genres/portrait.webp',
  tags: [{ id: 'soft', name: 'Soft light', slug: 'soft-light', category: 'mood' }],
};
const provider = {
  id: 'compact-person',
  type: 'photographer',
  displayName: 'Linh Nguyen',
  bio: 'Portraits in natural light.',
  city: '',
  district: '',
  genres: ['portrait'],
  styles: [],
  priceFrom: null,
  ratingAvg: null,
  reviewCount: 0,
};

for (const width of [1280, 375]) {
  test(`image-only cards and default profile cover at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let coverPath: string | null = null;
    await page.route('**/v1/photographers/compact-person', (route) =>
      route.fulfill({
        json: {
          data: {
            provider,
            coverPath,
            portfolios: [album],
            services: [],
            reviews: [],
          },
        },
      }),
    );
    await page.route('**/v1/tags', (route) => route.fulfill({ json: { data: album.tags } }));
    await page.route('**/v1/portfolios?*', (route) => route.fulfill({ json: { data: [album] } }));
    await page.route('**/v1/portfolios/compact-album', (route) =>
      route.fulfill({
        json: {
          data: {
            portfolio: album,
            images: [
              {
                id: 'photo',
                caption: 'A quiet portrait by the window.',
                provenance: 'captured',
                url: album.coverUrl,
                tags: album.tags,
              },
            ],
          },
        },
      }),
    );
    await page.route('**/storage/v1/object/public/profile-covers/**', (route) =>
      route.fulfill({
        path: 'apps/web/src/assets/genres/portrait2.webp',
        contentType: 'image/webp',
      }),
    );

    const checkCaption = async () => {
      const card = page.locator('.media-card').first();
      const image = card.locator('img');
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((node) => node.naturalWidth)).toBeGreaterThan(0);
      await page.mouse.move(0, 0);
      const caption = card.locator('.media-card-caption');
      await expect(caption).toHaveCSS('opacity', '0');
      await expect(card.locator('.card-tag, .media-card-copy, .media-card-badge')).toHaveCount(0);
      await card.locator('.media-card-image').hover();
      await expect(caption).toHaveCSS('opacity', '1');
      const imageBounds = await image.boundingBox();
      const captionBounds = await caption.boundingBox();
      expect(
        Math.abs(imageBounds!.y + imageBounds!.height - captionBounds!.y - captionBounds!.height),
      ).toBeLessThan(2);
      expect(imageBounds!.height).toBeLessThanOrEqual(280);
      await card.screenshot({ path: `.artifacts/compact-caption-${width}.png` });
      await page.mouse.move(0, 0);
      await expect(caption).toHaveCSS('opacity', '0');
      await card.locator('.media-card-image').focus();
      await expect(caption).toHaveCSS('opacity', '1');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    };

    await page.goto('/explore?mode=style&project=project-1');
    await checkCaption();
    await expect(page.locator('.media-card-image').first()).toHaveAttribute(
      'href',
      '/portfolios/compact-album?project=project-1',
    );
    await page.goto('/providers/photographer/compact-person');
    await expect(page.locator('.profile-cover')).toHaveClass(/profile-cover-empty/);
    await expect(page.locator('.profile-cover img')).toHaveCount(0);
    await checkCaption();
    await page
      .locator('.profile-cover')
      .screenshot({ path: `.artifacts/default-cover-${width}.png` });

    coverPath = 'compact-person/custom.webp';
    await page.reload();
    await expect(page.locator('.profile-cover')).toHaveClass(/profile-cover-custom/);
    await expect(page.locator('.profile-cover img')).toHaveAttribute(
      'src',
      /profile-covers\/compact-person\/custom.webp/,
    );
    await expect
      .poll(() =>
        page.locator('.profile-cover img').evaluate((node: HTMLImageElement) => node.naturalWidth),
      )
      .toBeGreaterThan(0);

    await page.route('**/profile-covers/compact-person/broken.webp', (route) => route.abort());
    coverPath = 'compact-person/broken.webp';
    await page.reload();
    await expect(page.locator('.profile-cover')).toHaveClass(/profile-cover-empty/);
    await expect(page.locator('.profile-cover img')).toHaveCount(0);

    await page.goto('/portfolios/compact-album');
    await checkCaption();
    await page.locator('.media-card-image').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.card-tag')).toHaveCount(0);
    await page.mouse.move(0, 0);
    await expect(dialog.locator('.media-card-caption')).toHaveCSS('opacity', '0');
    await dialog.locator('.photo-lightbox-image').hover();
    await expect(dialog.locator('.media-card-caption')).toHaveCSS('opacity', '1');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
}
