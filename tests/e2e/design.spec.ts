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
    await expect(page.locator('.glimpse-thumbnail').first()).toHaveCSS('border-top-width', '5px');
    await expect(page.locator('.glimpse-thumbnail').first()).toHaveCSS(
      'border-top-left-radius',
      '0px',
    );
    await expect(page.locator('.moodboard-photo').first()).toHaveCSS('border-top-width', '7px');
    await expect(page.locator('.moodboard-photo').first()).toHaveCSS(
      'border-top-left-radius',
      '0px',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });
}

test('the Home lens keeps turning slowly while the page scrolls in either direction', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/home#genres');
  const rotor = page.locator('.aperture-rotor');
  await expect(rotor).toHaveAttribute('style', /rotate\(-/);

  const { advances, scrollPositions } = await rotor.evaluate(async (node) => {
    const start = window.scrollY;
    const angle = () => -parseFloat((node as HTMLElement).style.transform.slice('rotate('.length));
    const advances = [];
    const scrollPositions = new Set<number>();
    let previous = angle();
    for (let frame = 0; frame < 12; frame++) {
      window.scrollTo({ top: start + (frame % 2 === 0 ? 120 : 0), behavior: 'instant' });
      await new Promise(requestAnimationFrame);
      scrollPositions.add(window.scrollY);
      const current = angle();
      advances.push(current - previous);
      previous = current;
    }
    return { advances, scrollPositions: scrollPositions.size };
  });
  expect(scrollPositions).toBeGreaterThan(1);
  expect(advances.every((advance) => advance >= 0 && advance < 0.35)).toBe(true);
  expect(advances.reduce((total, advance) => total + advance, 0)).toBeGreaterThan(0.05);
});

test('each genre has two distinct, decodable samples and About has both prints', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.addInitScript(() => localStorage.setItem('frameroom.language', 'vi'));
  await page.goto('/home#genres');
  const controls = page.locator('.aperture-dots button');
  await expect(controls).toHaveCount(12);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const stories = page.locator('.aperture-stories');
  const storyHeight = await stories.evaluate((node) => node.getBoundingClientRect().height);
  for (const control of await controls.all()) {
    await control.click();
    await expect(control).toHaveAttribute('aria-pressed', 'true');
    expect(await stories.evaluate((node) => node.getBoundingClientRect().height)).toBe(storyHeight);
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
