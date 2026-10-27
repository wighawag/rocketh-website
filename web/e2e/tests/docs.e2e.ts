import {test, expect} from '@playwright/test';
import {PLAIN_URL} from '../ports';

/**
 * The docs site, built, against the sample content in `docs/`.
 *
 * Run against the production build on a plain static host (the same server
 * the service worker tests use), because that is what ships: prerendered
 * pages, the Pagefind index written after the build, and client-side
 * navigation once the app has hydrated.
 */

const url = (path: string) => `${PLAIN_URL}${path}`;

/** Wait until SvelteKit has hydrated, so clicks are handled by the app. */
async function hydrated(page: import('@playwright/test').Page) {
	await expect(page.locator('#app-loader')).toHaveCount(0, {timeout: 15_000});
}

test('navigates from the home page through a section', async ({page}) => {
	await page.goto(url('/'));
	await expect(page.getByTestId('hero')).toContainText('Docs Template');
	await expect(page.getByTestId('features')).toBeVisible();
	await hydrated(page);

	await page.getByRole('link', {name: 'Get started'}).click();
	await expect(page).toHaveURL(url('/guide/'));
	await expect(page.locator('h1')).toHaveText('Introduction');

	const sidebar = page.getByTestId('sidebar').first();
	await sidebar.getByRole('link', {name: 'Getting started'}).click();
	await expect(page).toHaveURL(url('/guide/getting-started/'));
	await expect(
		sidebar.getByRole('link', {name: 'Getting started'}),
	).toHaveAttribute('aria-current', 'page');

	// Breadcrumb, then previous/next in sidebar order.
	await expect(page.getByLabel('breadcrumb')).toContainText('Guide');
	await page.locator('a[rel=next]').click();
	await expect(page).toHaveURL(url('/guide/writing/'));

	// A nav-file section has its own sidebar.
	await page
		.getByRole('navigation', {name: 'Sections'})
		.getByRole('link', {name: 'Reference'})
		.click();
	await expect(page).toHaveURL(url('/reference/'));
	await expect(page.getByTestId('sidebar').first()).toContainText('Overview');

	await expect(page.getByTestId('edit-link')).toHaveAttribute(
		'href',
		/\/edit\/main\/docs\/reference\/index\.md$/,
	);
});

test('the table of contents follows the reader', async ({page}) => {
	await page.goto(url('/guide/writing/'));
	await hydrated(page);
	const toc = page.getByTestId('toc');
	await page.locator('#images').scrollIntoViewIfNeeded();
	await page.evaluate(() => {
		const top = document.getElementById('images')!.getBoundingClientRect().top;
		window.scrollBy(0, top - 60);
	});
	await expect(toc.getByRole('link', {name: 'Images'})).toHaveAttribute(
		'aria-current',
		'location',
	);
	await expect(toc.getByRole('link', {name: 'Containers'})).not.toHaveAttribute(
		'aria-current',
		'location',
	);
});

test('searches with the command palette', async ({page}) => {
	await page.goto(url('/guide/'));
	await hydrated(page);
	await page.keyboard.press('ControlOrMeta+k');
	const input = page.getByTestId('search-input');
	await expect(input).toBeFocused();
	await input.fill('pagefind');
	const first = page.getByTestId('search-result').first();
	await expect(first).toContainText('Search');
	await first.click();
	await expect(page).toHaveURL(url('/guide/search/'));
});

test('follows the system theme, and the toggle overrides it', async ({
	browser,
}) => {
	const context = await browser.newContext({colorScheme: 'dark'});
	const page = await context.newPage();
	await page.goto(url('/guide/'));
	await hydrated(page);
	await expect(page.locator('html')).toHaveClass(/dark/);
	await page.getByTestId('theme-toggle').click();
	await expect(page.locator('html')).not.toHaveClass(/dark/);
	await context.close();
});

test('switches code-group tabs and copies code', async ({page, context}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto(url('/guide/getting-started/'));
	await hydrated(page);
	const group = page.locator('[data-code-group]').first();
	await expect(group.getByRole('tab', {name: 'pnpm'})).toHaveAttribute(
		'aria-selected',
		'true',
	);
	await group.getByRole('tab', {name: 'npm', exact: true}).click();
	await expect(
		group.getByRole('tab', {name: 'npm', exact: true}),
	).toHaveAttribute('aria-selected', 'true');
	await expect(group.getByRole('tabpanel')).toHaveText(/npm install/);

	const panel = group.getByRole('tabpanel');
	await panel.hover();
	await panel.getByRole('button', {name: 'Copy code'}).click();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
		'npm install',
	);
});

test('mounts embeds: components and a custom element', async ({page}) => {
	await page.goto(url('/guide/writing/embeds/'));
	await hydrated(page);
	const counters = page.getByTestId('counter');
	await expect(counters).toHaveCount(2);
	const first = counters.first();
	await expect(first.getByTestId('count')).toHaveText('3');
	await first.getByRole('button', {name: 'Increment'}).click();
	await expect(first.getByTestId('count')).toHaveText('4');
	await expect(counters.nth(1).getByTestId('count')).toHaveText('10');
	await expect(page.locator('hello-element')).toContainText('Hello, reader!');
});

test('lists articles and serves a feed', async ({page, request}) => {
	await page.goto(url('/articles/'));
	const list = page.getByTestId('article-list');
	await expect(list.locator('h2')).toHaveText([
		'Hello, world',
		'Writing a tutorial',
	]);
	const feed = await request.get(url('/feed.xml'));
	expect(feed.ok()).toBe(true);
	expect(await feed.text()).toContain('<title>Hello, world</title>');
});

test('opens the menu on a small screen', async ({browser}) => {
	const context = await browser.newContext({
		viewport: {width: 390, height: 800},
	});
	const page = await context.newPage();
	await page.goto(url('/reference/frontmatter/'));
	await hydrated(page);
	await page.getByTestId('menu-button').click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('link', {name: 'Navigation'}).click();
	await expect(page).toHaveURL(url('/reference/navigation/'));
	await expect(dialog).toBeHidden();
	await context.close();
});

test('shows a 404 page for an unknown address', async ({page}) => {
	// What a static host serves for an unknown path (see `_redirects`): the
	// SPA fallback, which routes the address it is loaded at.
	await page.goto(url('/404.html'));
	await expect(page.getByTestId('error-page')).toContainText('Page not found');
});
