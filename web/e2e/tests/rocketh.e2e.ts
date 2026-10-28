import {test, expect, devices} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {parse as parseYaml} from 'yaml';
import {loadDocsConfig} from '../../docs-engine/config.js';
import {PLAIN_URL} from '../ports';

/**
 * rocketh.dev, built against the rocketh checkout (`contentDir` in
 * docs.config.js), on a plain static host, as GitHub Pages serves it.
 *
 * This replaces the template's suite, which drives the template's sample
 * content (see .offshoot-omissions). It covers the same features on real
 * pages, plus what is specific to this site: every address the previous
 * (VitePress) site served, and the playground running for real.
 *
 * The content moves under this suite: a page can become a forwarding page
 * (rocketh's `_redirects.yaml`), and the sidebars are rocketh's
 * `_sidebar.yaml` files. So the suite restates neither: it reads the sidebars
 * from the checkout it was built against, and follows each forwarding page of
 * the build to the page it lands on, so it passes on rocketh's main before and
 * after a restructure of its pages.
 */

const url = (path: string) => `${PLAIN_URL}${path}`;

const {contentRoot} = await loadDocsConfig();

type NavItem = {text: string; link?: string; items?: NavItem[]};

/** The links of a section's sidebar, as rocketh's `_sidebar.yaml` has them. */
function sidebarLinks(section: string): {text: string; link: string}[] {
	const items = parseYaml(
		readFileSync(join(contentRoot, section, '_sidebar.yaml'), 'utf8'),
	) as NavItem[];
	const out: {text: string; link: string}[] = [];
	const walk = (list: NavItem[]) => {
		for (const item of list) {
			if (item.link) out.push({text: item.text, link: item.link});
			if (item.items) walk(item.items);
		}
	};
	walk(items);
	return out;
}

/** The sidebar label of the page at `link`. */
function sidebarLabel(section: string, link: string): string {
	const found = sidebarLinks(section).find((l) => l.link === link);
	if (!found) throw new Error(`${link} is not in the ${section} sidebar`);
	return found.text;
}

/**
 * Where an address ends up: itself when it is a page, else the target of its
 * forwarding page (whose meta refresh holds it, relative to the address).
 */
async function finalPath(
	request: import('@playwright/test').APIRequestContext,
	path: string,
): Promise<string> {
	const html = await (await request.get(url(path))).text();
	if (!html.includes('data-testid="redirect"')) return path;
	const target = html.match(/http-equiv="refresh" content="0; url=([^"]+)"/);
	if (!target) throw new Error(`${path} forwards, but to nowhere`);
	return new URL(target[1], url(path)).pathname;
}

async function hydrated(page: import('@playwright/test').Page) {
	await expect(page.locator('#app-loader')).toHaveCount(0, {timeout: 15_000});
}

/**
 * Every page the VitePress site served (its `.vitepress/dist`, 2026-10-27),
 * each of which must still be a page at the same address.
 */
const VITEPRESS_PAGES = [
	'/',
	'/documentation/',
	'/documentation/architecture/',
	'/documentation/captured-transactions/',
	'/documentation/core-concepts/',
	'/documentation/deploying/',
	'/documentation/examples/',
	'/documentation/execute-guard/',
	'/documentation/exporting-and-verifying/',
	'/documentation/fork-runs/',
	'/documentation/hardhat-deploy/',
	'/documentation/installation/',
	'/documentation/migration/',
	'/documentation/production-hardening/',
	'/documentation/script-lifecycle/',
	'/documentation/testing/',
	'/documentation/unknown-signers/',
	'/hardhat-deploy/',
	'/hardhat-deploy/documentation/command-and-tasks/',
	'/hardhat-deploy/documentation/configuration/',
	'/hardhat-deploy/documentation/environment/',
	'/hardhat-deploy/documentation/how-to/',
	'/hardhat-deploy/documentation/how-to/configure-named-accounts/',
	'/hardhat-deploy/documentation/how-to/configure-network-helpers/',
	'/hardhat-deploy/documentation/how-to/deploy-diamond-contracts/',
	'/hardhat-deploy/documentation/how-to/deploy-with-proxies/',
	'/hardhat-deploy/documentation/how-to/deployment-fixtures-in-tests/',
	'/hardhat-deploy/documentation/how-to/export-deployments/',
	'/hardhat-deploy/documentation/how-to/migration-from-v1/',
	'/hardhat-deploy/documentation/how-to/setup-first-project/',
	'/hardhat-deploy/documentation/how-to/use-fork-testing/',
	'/hardhat-deploy/documentation/how-to/use-tags-and-dependencies/',
	'/hardhat-deploy/documentation/how-to/use-viem-integration/',
	'/hardhat-deploy/documentation/how-to/verify-contracts/',
	'/hardhat-deploy/documentation/how-to-deploy-contracts/',
	'/hardhat-deploy/documentation/in-a-nutshell/',
	'/hardhat-deploy/documentation/installation/',
	'/hardhat-deploy/documentation/introduction/',
	'/hardhat-deploy/documentation/what-is-it-for/',
];

test('serves every address the previous site served', async ({request}) => {
	let pages = 0;
	let forwarded = 0;
	for (const path of VITEPRESS_PAGES) {
		const response = await request.get(url(path));
		expect(response.status(), path).toBe(200);
		const html = await response.text();
		if (html.includes('data-testid="redirect"')) {
			// A page that moved: its forwarding page must land on a page, with
			// its content prerendered (not on another forwarding page).
			forwarded++;
			const target = await finalPath(request, path);
			expect(target, path).not.toBe(path);
			const landed = await (await request.get(url(target))).text();
			expect(landed, `${path} -> ${target}`).not.toContain(
				'data-testid="redirect"',
			);
			expect(landed, `${path} -> ${target}`).toMatch(
				/data-pagefind-body|data-testid="hero"/,
			);
			continue;
		}
		// Prerendered WITH its content, so search engines see the page. A
		// landing page (`layout: home`) is a hero, not an article.
		pages++;
		expect(html, path).toMatch(/data-pagefind-body|data-testid="hero"/);
	}
	expect(pages + forwarded).toBe(VITEPRESS_PAGES.length);
	// One address was never a page of this site (docs.config.js `redirects`).
	const moved = await request.get(url('/introduction/'));
	expect(moved.status()).toBe(200);
	expect(await moved.text()).toContain(
		'content="0; url=https://github.com/wighawag/rocketh#readme"',
	);
});

test('the home page links into both sections and to GitHub', async ({page}) => {
	await page.goto(url('/'));
	await expect(page).toHaveTitle('rocketh');
	await expect(page.getByTestId('hero')).toContainText(
		'Framework-agnostic deployment system for EVM smart contracts',
	);
	await expect(page.getByTestId('social-link')).toHaveAttribute(
		'href',
		'https://github.com/wighawag/rocketh/#readme',
	);
	await hydrated(page);
	await page.getByRole('link', {name: 'Documentation'}).last().click();
	await expect(page).toHaveURL(url('/documentation/'));
	await expect(page.locator('h1')).toHaveText('Introduction');
});

test("lists this repository's articles, edits them here, and feeds them", async ({
	page,
	request,
}) => {
	// From the header, as a reader finds them.
	await page.goto(url('/documentation/'));
	await hydrated(page);
	await page.getByRole('link', {name: 'Articles', exact: true}).first().click();
	await expect(page).toHaveURL(url('/articles/'));
	const list = page.getByTestId('article-list').getByRole('heading');
	const count = await list.count();
	expect(count).toBeGreaterThan(0);

	// Every article is in the feed, at its own address.
	const feed = await (await request.get(url('/feed.xml'))).text();
	expect(feed.match(/<item>/g)).toHaveLength(count);

	// An article comes from articles/ in THIS repository, so its edit link
	// points here, not at rocketh.
	await list.first().getByRole('link').click();
	await expect(page).toHaveURL(/\/articles\/[^/]+\/$/);
	const file = new URL(page.url()).pathname.split('/').at(-2);
	await expect(page.locator('article time')).toBeVisible();
	await expect(
		page.getByRole('link', {name: 'Edit this page on GitHub'}),
	).toHaveAttribute(
		'href',
		`https://github.com/wighawag/rocketh-website/edit/main/articles/${file}.md`,
	);
	expect(feed).toContain(`<link>https://rocketh.dev/articles/${file}/</link>`);
});

test('shows the sidebar of the content, in its order', async ({page}) => {
	await page.goto(url('/documentation/fork-runs/'));
	const links = page.getByTestId('sidebar').first().getByRole('link');
	await expect(links).toHaveText(
		sidebarLinks('documentation').map((l) => l.text),
	);
});

test('gives the hardhat-deploy landing page its own card', async ({page}) => {
	await page.goto(url('/hardhat-deploy/'));
	await expect(page).toHaveTitle('hardhat-deploy | rocketh');
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
		'content',
		'https://rocketh.dev/hardhat-deploy-preview.png',
	);
});

test('switches code-group tabs', async ({page, request}) => {
	await page.goto(
		url(
			await finalPath(request, '/hardhat-deploy/documentation/installation/'),
		),
	);
	await hydrated(page);
	const group = page.locator('[data-code-group]').first();
	await group.getByRole('tab', {name: 'pnpm'}).click();
	await expect(group.getByRole('tab', {name: 'pnpm'})).toHaveAttribute(
		'aria-selected',
		'true',
	);
	await expect(group).toContainText('pnpm dlx hardhat-deploy init');
});

test('renders ::: containers', async ({page, request}) => {
	await page.goto(url(await finalPath(request, '/documentation/migration/')));
	await expect(page.locator('.callout-warning').first()).toContainText(
		'Three built-in proxy names changed',
	);
	await page.goto(url('/documentation/unknown-signers/'));
	await expect(page.locator('.callout-danger').first()).toBeVisible();
});

test('searches the whole site', async ({page}) => {
	await page.goto(url('/documentation/'));
	await hydrated(page);
	await page.keyboard.press('ControlOrMeta+k');
	const input = page.getByTestId('search-input');
	await expect(input).toBeFocused();
	await input.fill('unknown signer');
	const first = page.getByTestId('search-result').first();
	await expect(first).toContainText('Handling unknown signers');
	await first.click();
	await expect(page).toHaveURL(url('/documentation/unknown-signers/'));
});

test('runs the playground, all four steps', async ({page}) => {
	test.setTimeout(120_000);
	await page.goto(url('/documentation/'));
	await hydrated(page);
	const playground = page.locator('rocketh-playground');
	await playground.getByRole('button', {name: /Start/}).click();
	for (const next of [
		'Step 2: Write a greeting',
		'Step 3: Upgrade the implementation',
		'Step 4: Write another greeting',
	]) {
		const button = playground.getByRole('button', {name: next});
		await expect(button).toBeEnabled({timeout: 60_000});
		await button.click();
	}
	await expect(playground).toContainText('Write another greeting finished', {
		timeout: 60_000,
	});
	await expect(
		playground.getByRole('button', {name: /Start again/}),
	).toBeVisible();
});

test('follows the system theme, and the toggle overrides it', async ({
	browser,
}) => {
	const context = await browser.newContext({colorScheme: 'dark'});
	const page = await context.newPage();
	await page.goto(url('/documentation/fork-runs/'));
	await hydrated(page);
	await expect(page.locator('html')).toHaveClass(/dark/);
	await page.getByTestId('theme-toggle').click();
	await expect(page.locator('html')).not.toHaveClass(/dark/);
	await context.close();
});

test('opens the menu on a small screen', async ({browser}) => {
	const context = await browser.newContext({...devices['iPhone 13']});
	const page = await context.newPage();
	await page.goto(url('/documentation/fork-runs/'));
	await hydrated(page);
	await page.getByTestId('menu-button').click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toContainText(
		sidebarLabel('documentation', '/documentation/fork-runs/'),
	);
	await dialog
		.getByRole('link', {
			name: sidebarLabel(
				'documentation',
				'/documentation/captured-transactions/',
			),
		})
		.click();
	await expect(page).toHaveURL(url('/documentation/captured-transactions/'));
	await context.close();
});
