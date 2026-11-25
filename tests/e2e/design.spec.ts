import { test, expect } from '@playwright/test';

test('botanical flowers stay joined to their stems while swaying', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/home', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.hero-flower-left .botanical-main-head')).toBeVisible();
  expect(
    await page.locator('.hero-flower-left .botanical-main-head .botanical-petal').count(),
  ).toBeGreaterThan(3);
  const positions = [];
  for (const time of [0, 1000, 2100, 3100]) {
    const geometry = await page.locator('.hero-flower-left').evaluate((node, currentTime) => {
      node.querySelectorAll('*').forEach((element) =>
        element.getAnimations().forEach((animation) => {
          animation.pause();
          animation.currentTime = currentTime;
        }),
      );
      const stalk = node.querySelector<SVGPathElement>('.botanical-tip > .botanical-stalk')!;
      const end = stalk
        .getPointAtLength(stalk.getTotalLength())
        .matrixTransform(stalk.getScreenCTM()!);
      const origins = [
        ...node.querySelectorAll<SVGGElement>('.botanical-main-head .botanical-petal'),
      ].map((petal) => new DOMPoint(0, 0).matrixTransform(petal.getScreenCTM()!));
      return {
        x: end.x,
        y: end.y,
        gaps: origins.map((point) => Math.hypot(point.x - end.x, point.y - end.y)),
      };
    }, time);
    expect(Math.max(...geometry.gaps)).toBeLessThan(0.1);
    positions.push(geometry);
  }
  expect(
    Math.max(
      ...positions.map((position) =>
        Math.hypot(position.x - positions[0].x, position.y - positions[0].y),
      ),
    ),
  ).toBeGreaterThan(8);
  await expect(page.locator('.hero-flower-left .botanical-sprig')).toHaveCount(3);
  await expect(page.locator('.watercolor-wash-left')).toHaveCount(1);
  await page
    .locator('.hero-flower-left .botanical-main-head')
    .screenshot({ path: '.artifacts/botanical-detail.png' });
  await page.screenshot({ path: '.artifacts/botanical-desktop.png' });
  await page.setViewportSize({ width: 375, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: '.artifacts/botanical-mobile.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page
      .locator('.hero-flower-left .botanical-stem')
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe('none');
});

for (const width of [1280, 375]) {
  test(`Home uses fixed local samples at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: 900 });
    const lookups: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/v1/portfolios')) lookups.push(request.url());
    });
    await page.goto('/home#genres');
    const photo = page.locator('.moodboard-photo img').first();
    await photo.scrollIntoViewIfNeeded();
    await expect
      .poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
    const samples = () =>
      page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .filter(
            (entry) =>
              (entry as PerformanceResourceTiming).initiatorType === 'fetch' &&
              entry.name.includes('.webp'),
          )
          .map((entry) => new URL(entry.name).pathname),
      );
    const first = await samples();
    expect(first.length).toBeGreaterThan(0);
    await page.reload();
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => samples()).toContain(first[0]);
    const transfer = await page.evaluate(
      (path) =>
        performance
          .getEntriesByType('resource')
          .filter(
            (entry) =>
              new URL(entry.name).pathname === path &&
              (entry as PerformanceResourceTiming).initiatorType === 'fetch',
          )
          .map((entry) => (entry as PerformanceResourceTiming).transferSize),
      first[0],
    );
    expect(transfer).toContain(0);
    expect(lookups).toEqual([]);
    await expect(page.locator('.glimpse-thumbnail').first()).toHaveCSS('border-top-style', 'solid');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });

  test(`catalog cards reveal captions over compact images and retain incremental results at ${width}px`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: 900 });
    const tag = { id: 'tag', name: 'Natural light', slug: 'natural-light', kind: 'mood' };
    const album = {
      id: 'album',
      title: 'Window light',
      description: 'An afternoon in the studio',
      ownerType: 'photographer',
      photographerId: 'photographer',
      ownerName: 'Linh Nguyen',
      genre: 'portrait',
      tags: [tag],
      coverUrl: '/src/assets/genres/portrait.webp',
    };
    const pages: string[] = [];
    await page.route('**/v1/tags', (route) => route.fulfill({ json: { data: [tag] } }));
    await page.route('**/v1/portfolios?*', (route) => {
      const params = new URL(route.request().url()).searchParams;
      const number = params.get('page') || '1';
      pages.push(number);
      return route.fulfill({
        json: {
          data:
            number === '1'
              ? Array.from({ length: 12 }, (_, index) => ({ ...album, id: `album-${index}` }))
              : [{ ...album, id: 'last' }],
        },
      });
    });
    await page.route('**/v1/portfolios/album-0', (route) =>
      route.fulfill({
        json: {
          data: {
            portfolio: { ...album, id: 'album-0' },
            images: [
              {
                id: 'photo',
                caption: 'A quiet portrait',
                tags: [tag],
                provenance: 'captured',
                url: album.coverUrl,
              },
            ],
          },
        },
      }),
    );
    await page.goto('/genres/portrait?project=project-1');
    await page.locator('.search-start').scrollIntoViewIfNeeded();
    const cards = page.locator('.media-card');
    await expect(cards).toHaveCount(12);
    expect(pages).not.toContain('2');
    const first = cards.first();
    const caption = first.locator('.media-card-caption');
    await expect(caption).toHaveCSS('opacity', '0');
    await expect(first.locator('.media-card-copy, .card-tag, .media-card-badge')).toHaveCount(0);
    await expect(first.getByRole('link', { name: album.title, exact: true })).toHaveAttribute(
      'href',
      '/portfolios/album-0?project=project-1',
    );
    const image = first.locator('img');
    await expect.poll(() => image.evaluate((node) => node.naturalWidth)).toBeGreaterThan(0);
    const dimensions = await image.evaluate((node) => ({
      fit: getComputedStyle(node).objectFit,
      width: node.clientWidth,
      height: node.clientHeight,
      sourceRatio: node.naturalWidth / node.naturalHeight,
    }));
    expect(dimensions.fit).toBe('contain');
    expect(dimensions.height).toBeLessThanOrEqual(280);
    expect(dimensions.width / dimensions.height).toBeCloseTo(dimensions.sourceRatio, 2);
    await page.locator('.load-more button').scrollIntoViewIfNeeded();
    await expect(cards).toHaveCount(13);
    await first.getByRole('link').focus();
    await expect(caption).toHaveCSS('opacity', '1');
    await expect(caption).toContainText(album.description);
    await first.getByRole('link').click();
    await expect(page).toHaveURL(/portfolios\/album-0\?project=project-1$/);
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('A quiet portrait');
    await expect(cards.locator('.media-card-copy, .card-tag, .media-card-badge')).toHaveCount(0);
    await cards.getByRole('button', { name: /A quiet portrait/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });
}

test('each genre has two distinct, decodable samples and About has both prints', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/home#genres');
  const controls = page.locator('.aperture-dots button');
  await expect(controls).toHaveCount(12);
  for (const control of await controls.all()) {
    await control.click();
    await expect(control).toHaveAttribute('aria-pressed', 'true');
    const images = page.locator('.moodboard-photo img');
    await expect(images).toHaveCount(2);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    }
    const sources = await images.evaluateAll((imgs) => imgs.map((img) => img.currentSrc));
    expect(new Set(sources).size).toBe(2);
  }
  await page.goto('/about');
  const prints = page.locator('.about-photographs img');
  await expect(prints).toHaveCount(2);
  for (const print of await prints.all()) {
    await expect.poll(() => print.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  }
});

test('collection keyword, taxonomy and ordering reach the catalog API', async ({ page }) => {
  const queries: URLSearchParams[] = [];
  const tag = { id: 'soft', name: 'Soft light', slug: 'soft-light', kind: 'mood' };
  await page.route('**/v1/tags', (route) => route.fulfill({ json: { data: [tag] } }));
  await page.route('**/v1/portfolios?*', (route) => {
    queries.push(new URL(route.request().url()).searchParams);
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto('/genres/portrait');
  await page.locator('.collection-search input').fill('window');
  await page.locator('.collection-search button').click();
  await page.locator('.taxonomy-filter summary').click();
  await page.getByRole('button', { name: 'Soft light' }).click();
  await page.locator('.taxonomy-filter summary').click();
  await page.getByLabel('Sort by', { exact: true }).click();
  await page.getByRole('option', { name: /A.Z/ }).click();
  await expect
    .poll(() =>
      queries.some(
        (query) =>
          query.get('q') === 'window' &&
          query.get('genre') === 'portrait' &&
          query.get('tag') === 'soft-light' &&
          query.get('sort') === 'name',
      ),
    )
    .toBe(true);
});
