import { test, expect } from '@playwright/test';

test('botanical flowers stay joined to their stems while swaying', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/explore', { waitUntil: 'domcontentloaded' });
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
  test(`photo discovery fits ${width}px and uses real collections and taxonomy`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const response = await request.get(
      'http://localhost:4000/v1/portfolios?pageSize=12&sort=newest',
    );
    expect(response.ok()).toBe(true);
    const { data: portfolios } = await response.json();
    const tagsResponse = await request.get('http://localhost:4000/v1/tags');
    expect(tagsResponse.ok()).toBe(true);
    const { data: tags } = await tagsResponse.json();
    await page.goto('/explore', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: 'Every perspective, a story to tell.' }),
    ).toBeVisible();
    expect(
      await page
        .locator('.topbar-actions > *')
        .evaluateAll((nodes) => nodes.slice(0, 3).map((node) => node.className)),
    ).toEqual(['language-switcher', 'user-search', 'notification-bell']);
    await expect(page.getByText('Reset demo', { exact: true })).toHaveCount(0);
    await expect(page.locator('.collection-card')).toHaveCount(portfolios.length);
    await page.screenshot({ path: `.artifacts/explore-${width}.png`, animations: 'disabled' });
    await page.locator('#collections').scrollIntoViewIfNeeded();
    await page.locator('.taxonomy-filter > summary').click();
    const categories = new Set(
      tags.map((tag: { category?: string; kind: string }) => tag.category || tag.kind),
    );
    await expect(page.locator('.taxonomy-groups fieldset')).toHaveCount(categories.size);
    expect(await page.locator('.taxonomy-groups fieldset button').count()).toBe(tags.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.locator('.taxonomy-filter > summary').click();
    await expect(page.locator('.collection-image img').first()).toHaveAttribute('loading', 'lazy');
    if (portfolios.length) {
      const first = page.locator('.collection-card').first();
      await first.scrollIntoViewIfNeeded();
      await expect(first.getByRole('heading')).toHaveText(portfolios[0].title);
      if (portfolios[0].description) await expect(first).toContainText(portfolios[0].description);
      expect(await first.locator('img').evaluate((node) => getComputedStyle(node).objectFit)).toBe(
        'contain',
      );
      await expect
        .poll(
          () => first.locator('img').evaluate((node) => (node as HTMLImageElement).naturalWidth),
          { timeout: 15000 },
        )
        .toBeGreaterThan(0);
      const dimensions = await first.locator('img').evaluate((node) => {
        const image = node as HTMLImageElement;
        return {
          width: image.clientWidth,
          height: image.clientHeight,
          ratio: image.clientWidth / image.clientHeight,
          natural: image.naturalWidth / image.naturalHeight,
          frameWidth: image.closest('.collection-image')!.clientWidth,
          frameHeight: image.closest('.collection-image')!.clientHeight,
        };
      });
      expect(dimensions.width).toBeLessThanOrEqual(420);
      expect(dimensions.height).toBeLessThanOrEqual(360);
      expect(dimensions.ratio).toBeCloseTo(dimensions.natural, 2);
      expect(Math.abs(dimensions.width - dimensions.frameWidth)).toBeLessThanOrEqual(2);
      expect(Math.abs(dimensions.height - dimensions.frameHeight)).toBeLessThanOrEqual(2);
    }
    await page.screenshot({ path: `.artifacts/collections-${width}.png`, animations: 'disabled' });
    if (width === 1280) {
      const nextPage = page.waitForResponse(
        (response) =>
          response.url().includes('/v1/portfolios?') &&
          new URL(response.url()).searchParams.get('page') === '2',
      );
      await page.getByRole('button', { name: 'Load more collections' }).click();
      const nextResponse = await nextPage;
      expect(nextResponse.ok()).toBe(true);
      const { data: more } = await nextResponse.json();
      await expect(page.locator('.collection-card')).toHaveCount(portfolios.length + more.length);
    }
  });
}

test('collection keyword and ordering reach the API and return matching results', async ({
  page,
}) => {
  await page.goto('/explore', { waitUntil: 'domcontentloaded' });
  await page.locator('#collections').scrollIntoViewIfNeeded();
  await page.getByLabel('Search', { exact: true }).fill('portrait');
  const search = page.waitForResponse(
    (response) =>
      response.url().includes('/v1/portfolios?') &&
      new URL(response.url()).searchParams.get('q') === 'portrait',
  );
  await page
    .locator('.collection-search')
    .getByRole('button', { name: 'Search', exact: true })
    .click();
  expect((await search).ok()).toBe(true);
  const sort = page.waitForResponse(
    (response) =>
      response.url().includes('/v1/portfolios?') &&
      new URL(response.url()).searchParams.get('sort') === 'name',
  );
  await page.getByLabel('Sort by', { exact: true }).selectOption('name');
  const response = await sort;
  expect(response.ok()).toBe(true);
  const { data } = await response.json();
  for (const portfolio of data)
    expect(`${portfolio.title} ${portfolio.description}`.toLowerCase()).toContain('portrait');
});

for (const width of [1280, 375]) {
  test(`Explore section transitions and highlights respect motion preferences at ${width}px`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/explore', { waitUntil: 'domcontentloaded' });
    const hero = page.locator('.hero-content');
    await expect(hero).toHaveClass(/is-revealed/);
    expect(
      await page
        .locator('.hero-flower-left')
        .evaluate((node) => parseFloat(getComputedStyle(node).width)),
    ).toBeLessThanOrEqual(width === 375 ? 225 : 370);
    const template = page.locator('.template-section');
    await expect(template).toHaveClass(/reveal-ready/);
    await expect(template).toHaveCSS('opacity', '0');
    for (const selector of ['.genre-stories', '.template-section', '.photographer-collection']) {
      const layer = page.locator(selector);
      await expect(layer).toBeAttached();
      const style = await layer.evaluate((node) => {
        const pseudo = getComputedStyle(node, '::before');
        return { background: pseudo.backgroundImage, pointerEvents: pseudo.pointerEvents };
      });
      expect(style.background).toContain('gradient');
      expect(style.pointerEvents).toBe('none');
    }
    await template.scrollIntoViewIfNeeded();
    await expect(template).toHaveClass(/is-revealed/);
    await expect(template).toHaveCSS('opacity', '1');
    await expect(template.locator('.section-highlight')).toHaveCSS('background-size', /^100% /);
    await expect(template.locator('.emphasis-link')).toHaveCSS('animation-iteration-count', '1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await template.screenshot({
      path: `.artifacts/explore-transition-${width}.png`,
      animations: 'disabled',
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(template.locator('.emphasis-link')).toHaveCSS('animation-name', 'none');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.hero-content')).toHaveCSS('opacity', '1');
    await expect(page.locator('.template-section')).toHaveCSS('opacity', '1');
  });
}
