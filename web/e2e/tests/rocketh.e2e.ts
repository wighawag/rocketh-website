import {test, expect, devices} from '@playwright/test';
import {PLAIN_URL} from '../ports';

/**
 * rocketh.dev, built against the rocketh checkout (`contentDir` in
 * docs.config.js), on a plain static host, as GitHub Pages serves it.
 *
 * This replaces the template's suite, which drives the template's sample
 * content (see .offshoot-omissions). It covers the same features on real
 * pages, plus what is specific to this site: every address the previous
 * (VitePress) site served, and the playground running for real.
 */

const url = (path: string) => `${PLAIN_URL}${path}`;

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
	for (const path of VITEPRESS_PAGES) {
		const response = await request.get(url(path));
		expect(response.status(), path).toBe(200);
		// Prerendered WITH its content, so search engines see the page. The
		// two landing pages (`layout: home`) are a hero, not an article.
		const html = await response.text();
		if (path === '/' || path === '/hardhat-deploy/') {
			expect(html, path).toContain('data-testid="hero"');
		} else {
			expect(html, path).toContain('data-pagefind-body');
		}
	}
	// The one that is no longer a page forwards (docs.config.js `redirects`).
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

test('keeps the sidebar order and labels of the previous site', async ({
	page,
}) => {
	await page.goto(url('/documentation/fork-runs/'));
	const links = page.getByTestId('sidebar').first().getByRole('link');
	await expect(links).toHaveText([
		'Introduction',
		'Installation and Setup',
		'Core Concepts',
		'Using rocketh',
		'Examples',
		'Using hardhat-deploy',
		'Testing Deploy Scripts',
		'Rehearsing on a Fork',
		'Captured Transactions',
		'Exporting and Verifying',
		'Handling Unknown Signers',
		'Guarding Execute Calls',
		'Running Once, and Running Last',
		'Production Hardening',
		'Architecture Overview',
		'Migrating from v1',
	]);
});

test('gives the hardhat-deploy landing page its own card', async ({page}) => {
	await page.goto(url('/hardhat-deploy/'));
	await expect(page).toHaveTitle('hardhat-deploy | rocketh');
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
		'content',
		'https://rocketh.dev/hardhat-deploy-preview.png',
	);
});

test('switches code-group tabs', async ({page}) => {
	await page.goto(url('/hardhat-deploy/documentation/installation/'));
	await hydrated(page);
	const group = page.locator('[data-code-group]').first();
	await group.getByRole('tab', {name: 'pnpm'}).click();
	await expect(group.getByRole('tab', {name: 'pnpm'})).toHaveAttribute(
		'aria-selected',
		'true',
	);
	await expect(group).toContainText('pnpm dlx hardhat-deploy init');
});

test('renders ::: containers', async ({page}) => {
	await page.goto(url('/documentation/migration/'));
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
	await page.goto(url('/documentation/core-concepts/'));
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
	await expect(dialog).toContainText('Rehearsing on a Fork');
	await dialog.getByRole('link', {name: 'Captured Transactions'}).click();
	await expect(page).toHaveURL(url('/documentation/captured-transactions/'));
	await context.close();
});
