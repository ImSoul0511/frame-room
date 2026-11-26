import { expect, test } from '@playwright/test';

const photographer = {
  id: 'person',
  type: 'photographer',
  displayName: 'Linh Nguyễn',
  userName: 'linh.nguyen',
  bio: 'Lưu giữ những khoảnh khắc tự nhiên và câu chuyện của riêng bạn.',
  city: 'Hồ Chí Minh',
  district: '',
  genres: ['portrait', 'wedding'],
  styles: [],
  priceFrom: null,
  ratingAvg: null,
  reviewCount: 0,
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('frameroom.language', 'vi'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const width of [1280, 375]) {
  test(`photographers remain visible across every page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const requestedPages: number[] = [];
    await page.route('**/v1/photographers?*', async (route) => {
      const params = new URL(route.request().url()).searchParams;
      const number = Number(params.get('page'));
      requestedPages.push(number);
      expect(params.get('pageSize')).toBe('12');
      await route.fulfill({
        json: {
          data: Array.from({ length: number === 3 ? 1 : 12 }, (_, index) => ({
            ...photographer,
            id: `person-${(number - 1) * 12 + index}`,
            displayName: `Linh Nguyễn ${(number - 1) * 12 + index + 1}`,
          })),
        },
      });
    });
    await page.goto('/explore?project=project-1');
    const cards = page.locator('.photographer-search-card');
    await expect(cards).toHaveCount(12);
    const more = page.getByRole('button', { name: 'Xem thêm nhiếp ảnh gia', exact: true });
    await expect(more).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Xem thêm bộ ảnh' })).toHaveCount(0);
    await expect(cards.first()).toContainText('Hồ Chí Minh');
    await expect(cards.first()).toContainText(photographer.bio);
    await expect(cards.first().getByRole('link').last()).toHaveAttribute(
      'href',
      '/providers/photographer/person-0?project=project-1',
    );
    await page.screenshot({ path: `.artifacts/discovery-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await more.scrollIntoViewIfNeeded();
    await expect(cards).toHaveCount(24);
    await more.scrollIntoViewIfNeeded();
    await expect(cards).toHaveCount(25);
    await expect(page.getByText('Bạn đã xem hết kết quả phù hợp.')).toBeVisible();
    await expect(more).toHaveCount(0);
    expect(requestedPages).toEqual([1, 2, 3]);
  });
}

test('a stationary pagination sentinel continues loading and recovers from failure', async ({
  page,
}) => {
  let failed = false;
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.route('**/v1/photographers?*', async (route) => {
    const number = Number(new URL(route.request().url()).searchParams.get('page'));
    if (number === 2 && !failed) {
      failed = true;
      return route.fulfill({
        status: 503,
        json: { error: { code: 'UNAVAILABLE', message: '', details: [] } },
      });
    }
    return route.fulfill({
      json: {
        data: Array.from({ length: number === 4 ? 1 : 12 }, (_, index) => ({
          ...photographer,
          id: `${number}-${index}`,
        })),
      },
    });
  });
  await page.goto('/explore');
  // Keep the sentinel in view as results append, reproducing the observer stall.
  await page.addStyleTag({
    content: '.photographer-search-list { height: 80px; overflow: auto; }',
  });
  const retry = page.locator('.load-more button');
  await retry.scrollIntoViewIfNeeded();
  await expect(retry).toHaveText('Kiểm tra lại');
  await expect(page.locator('.photographer-search-card')).toHaveCount(12);
  await retry.click();
  await expect(page.locator('.photographer-search-card')).toHaveCount(37);
  await expect(page.locator('.load-more')).toHaveCount(0);
});

test('search, genre filters, reset, and style mode use their own results', async ({ page }) => {
  const searches: URLSearchParams[] = [];
  const portfolios: URLSearchParams[] = [];
  await page.route('**/v1/photographers?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    searches.push(params);
    return route.fulfill({ json: { data: params.get('q') === 'nobody' ? [] : [photographer] } });
  });
  await page.route('**/v1/tags', (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: 'soft',
            name: 'Soft light',
            nameVi: 'Ánh sáng dịu',
            slug: 'soft-light',
            category: 'mood',
          },
          { id: 'vintage', name: 'Vintage', nameVi: 'Hoài cổ', slug: 'vintage', category: 'style' },
        ],
      },
    }),
  );
  await page.route('**/v1/photos?*', (route) => {
    portfolios.push(new URL(route.request().url()).searchParams);
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto('/explore?project=project-1');
  const search = page.locator('.discovery-sidebar-search');
  await search.getByRole('searchbox').fill('Linh');
  await search.getByRole('button').click();
  await expect.poll(() => searches.at(-1)?.get('q')).toBe('Linh');
  await page.locator('.discovery-sidebar').getByLabel('Thể loại', { exact: true }).click();
  await page.getByRole('option', { name: 'Chân dung', exact: true }).click();
  await page.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
  await expect.poll(() => searches.at(-1)?.get('genre')).toBe('portrait');
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await expect.poll(() => searches.at(-1)?.has('genre')).toBe(false);
  await expect(page).toHaveURL(/project=project-1/);
  await search.getByRole('searchbox').fill('nobody');
  await search.getByRole('searchbox').press('Enter');
  await expect(page.locator('.discovery-results .empty-state')).toBeVisible();
  await search.getByRole('searchbox').fill('');
  await search.getByRole('searchbox').press('Enter');
  await page.getByRole('button', { name: 'Phong cách', exact: true }).click();
  await expect(page.locator('.discovery-results h2')).toHaveCount(0);
  await expect(page.locator('.photographer-search-card')).toHaveCount(0);
  await expect(page.locator('.discovery-results .empty-state')).toBeVisible();
  await page.locator('.tag-filter-trigger').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ánh sáng dịu', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Hoài cổ', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
  await expect.poll(() => portfolios.at(-1)?.get('tags')).toBe('soft-light,vintage');
});

test('live catalog can reach every public photographer', async ({ page }) => {
  const people = new Set<string>();
  for (let number = 1; ; number++) {
    const response = await page.request.get(
      `http://localhost:4000/v1/photographers?page=${number}&pageSize=12`,
    );
    expect(response.ok()).toBe(true);
    const { data } = await response.json();
    for (const person of data) people.add(person.id);
    if (data.length < 12) break;
    expect(number).toBeLessThan(100);
  }
  await page.goto('/explore');
  const cards = page.locator('.photographer-search-card');
  await expect(cards.first()).toBeVisible();
  while (await page.locator('.load-more').count()) {
    const before = await cards.count();
    await page.locator('.load-more').scrollIntoViewIfNeeded();
    await expect.poll(() => cards.count(), { timeout: 30000 }).toBeGreaterThan(before);
  }
  await expect(cards).toHaveCount(people.size);
  const ids = await cards
    .locator('.photographer-search-link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')!.split('/').at(-1)));
  expect(new Set(ids)).toEqual(people);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: '.artifacts/discovery-live-desktop.png' });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({ path: '.artifacts/discovery-live-mobile.png', fullPage: true });
});
