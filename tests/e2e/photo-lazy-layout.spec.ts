import { test, expect } from '@playwright/test';

for (const width of [1280, 375]) {
  test(`lazy photographs keep their positions while loading and appending at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/delayed-photo-*', async (route) => {
      await gate;
      await route.fulfill({
        path: 'apps/web/src/assets/genres/portrait.webp',
        contentType: 'image/webp',
      });
    });
    await page.route('**/v1/photos?*', (route) => {
      const number = Number(new URL(route.request().url()).searchParams.get('page'));
      return route.fulfill({
        json: {
          data: Array.from({ length: number === 1 ? 12 : 1 }, (_, index) => ({
            id: `${number}-${index}`,
            portfolioId: 'album',
            caption: `Photo ${index}`,
            tags: [],
            url: `/delayed-photo-${number}-${index}`,
            width: index === 0 ? null : 800,
            height: index === 0 ? null : 1200 + index * 80,
          })),
        },
      });
    });
    await page.goto('/inspiration');
    const photos = page.locator('.discovery-photo');
    await expect(photos).toHaveCount(12);
    const positions = () =>
      photos.evaluateAll((nodes) =>
        nodes.slice(0, 12).map((node) => {
          const box = node.getBoundingClientRect();
          return {
            id: node.getAttribute('href'),
            x: box.x + scrollX,
            y: box.y + scrollY,
            width: box.width,
            height: box.height,
          };
        }),
      );
    await expect.poll(async () => (await positions())[0].width).toBeGreaterThan(0);
    const before = await positions();
    await expect(photos.first().locator('img')).toHaveAttribute('loading', 'lazy');
    release();
    await expect
      .poll(() =>
        photos
          .first()
          .locator('img')
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    expect(await positions()).toEqual(before);
    await page.locator('.load-more button').last().scrollIntoViewIfNeeded();
    await expect(photos).toHaveCount(13);
    expect(await positions()).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });
}
