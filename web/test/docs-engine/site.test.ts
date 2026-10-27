import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {resolveConfig} from '../../docs-engine/config.js';
import {DocsSite} from '../../docs-engine/site';
import {
	breadcrumb,
	findSection,
	neighbours,
} from '../../src/lib/core/docs/navigation';

let root: string;

function write(files: Record<string, string>) {
	for (const [path, content] of Object.entries(files)) {
		const file = join(root, path);
		mkdirSync(dirname(file), {recursive: true});
		writeFileSync(file, content);
	}
}

async function site(
	extra: Record<string, unknown> = {},
	mode: 'dev' | 'build' = 'build',
) {
	const config = resolveConfig(
		{contentDir: root, articles: 'news', ...extra},
		join(root, 'docs.config.js'),
	);
	const s = new DocsSite(config, mode);
	await s.load();
	return s;
}

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), 'docs-site-'));
	write({
		'index.md':
			'---\nlayout: home\nhero:\n  actions:\n    - {text: Go, link: /guide/}\n---\n',
		'guide/index.md': '# Guide\n\n[install](install.md#setup)',
		'guide/install.md': '---\norder: 1\n---\n# Install\n\n## Setup\n',
		'guide/zeta.md': '# Zeta\n',
		'guide/alpha.md': '# Alpha\n',
		'guide/advanced/index.md': '---\norder: 2\n---\n# Advanced\n',
		'guide/advanced/tuning.md': '# Tuning\n',
		'guide/draft.md': '---\ndraft: true\n---\n# Draft\n',
		'api/_sidebar.yaml':
			'- text: Start\n  link: index.md\n- text: Calls\n  items:\n    - {text: Get, link: get/}\n',
		'api/index.md': '# API\n',
		'api/get.md': '# get\n',
		'api/unlisted.md': '# Unlisted\n',
		'news/2026-01-02-b.md': '---\ndate: 2026-01-02\n---\n# B\n',
		'news/2025-01-01-a.md': '---\ndate: 2025-01-01\n---\n# A\n',
		'node_modules/pkg/README.md': '# not a page\n',
	});
});

afterAll(() => rmSync(root, {recursive: true, force: true}));

describe('DocsSite', () => {
	it('maps files to routes and skips node_modules', async () => {
		const s = await site();
		expect(s.pages().map((p) => p.route)).toEqual([
			'/',
			'/api/',
			'/api/get/',
			'/api/unlisted/',
			'/guide/',
			'/guide/advanced/',
			'/guide/advanced/tuning/',
			'/guide/alpha/',
			'/guide/install/',
			'/guide/zeta/',
			'/news/2025-01-01-a/',
			'/news/2026-01-02-b/',
		]);
	});

	it('keeps drafts in dev only', async () => {
		const dev = await site({}, 'dev');
		expect(dev.pages().some((p) => p.route === '/guide/draft/')).toBe(true);
	});

	it('orders a generated sidebar by `order`, then alphabetically', async () => {
		const guide = (await site())
			.manifest()
			.sections.find((s) => s.dir === 'guide')!;
		expect(guide.sidebar).toEqual([
			{text: 'Guide', link: '/guide/'},
			{text: 'Install', link: '/guide/install/'},
			{
				text: 'Advanced',
				link: '/guide/advanced/',
				items: [{text: 'Tuning', link: '/guide/advanced/tuning/'}],
			},
			{text: 'Alpha', link: '/guide/alpha/'},
			{text: 'Zeta', link: '/guide/zeta/'},
		]);
	});

	it('uses a nav file when the section has one', async () => {
		const api = (await site())
			.manifest()
			.sections.find((s) => s.dir === 'api')!;
		expect(api.sidebar).toEqual([
			{text: 'Start', link: '/api/'},
			{text: 'Calls', items: [{text: 'Get', link: '/api/get/'}]},
		]);
	});

	it('reports no problems for good content', async () => {
		expect((await site()).check()).toEqual([]);
	});

	it('reports dead links, missing anchors and bad nav entries', async () => {
		write({
			'guide/broken.md': '# Broken\n\n[a](/nowhere/) [b](install.md#nope)',
			'api/_sidebar.yaml': '- text: Ghost\n  link: ghost.md\n',
		});
		try {
			const problems = (await site()).check().map((p) => p.message);
			expect(problems).toContain(
				'dead link `/nowhere/`: no page or public file at this path',
			);
			expect(
				problems.some((m) => m.startsWith('missing anchor `install.md#nope`')),
			).toBe(true);
			expect(problems).toContain('no page for link `ghost.md`');
		} finally {
			rmSync(join(root, 'guide/broken.md'));
			write({
				'api/_sidebar.yaml':
					'- text: Start\n  link: index.md\n- text: Calls\n  items:\n    - {text: Get, link: get/}\n',
			});
		}
	});

	it('treats a link to a draft as dead in a build, and fine in dev', async () => {
		write({'guide/to-draft.md': '# To draft\n\n[draft](draft.md)'});
		try {
			expect((await site()).check().map((p) => p.message)).toContain(
				'dead link `draft.md`: no such Markdown page',
			);
			expect((await site({}, 'dev')).check()).toEqual([]);
		} finally {
			rmSync(join(root, 'guide/to-draft.md'));
		}
	});

	it('resolves the feed, a site route, under a base path', async () => {
		write({'guide/feed.md': '# Feed\n\n[rss](/feed.xml)'});
		try {
			const s = await site({base: '/docs/'});
			expect(s.check()).toEqual([]);
			expect(
				s.entryForFile(join(root, 'guide/feed.md'))!.result.html,
			).toContain('href="../../../feed.xml"');
		} finally {
			rmSync(join(root, 'guide/feed.md'));
		}
	});

	it('forwards old addresses, and lets content link to them', async () => {
		write({'guide/old-link.md': '# Old link\n\n[old](/guide/setup/)'});
		try {
			const s = await site({
				redirects: {
					'/guide/setup': '/guide/install#setup',
					'/old-home/': 'https://example.com/elsewhere',
				},
			});
			expect(s.check()).toEqual([]);
			expect(s.manifest().redirects).toEqual({
				'/guide/setup/': '/guide/install/#setup',
				'/old-home/': 'https://example.com/elsewhere',
			});
		} finally {
			rmSync(join(root, 'guide/old-link.md'));
		}
	});

	it('reports a redirect that does not land, or hides a page', async () => {
		const s = await site({
			redirects: {
				'/guide/': '/api/',
				'/a/': '/nowhere/',
				'/b/': '/a/',
				'/c/': '/guide/install/#nope',
				'/d/': 'ftp://example.com/',
				'e/': '/api/',
			},
		});
		expect(s.check().map((p) => p.message)).toEqual([
			'redirect `/d/`: an external target must be an http(s) URL, not `ftp://example.com/`',
			'redirect `e/`: an old address must be a site path starting with `/`, without a query or an anchor',
			'redirect `/guide/`: is also a page; a page and a forwarding page cannot share an address',
			'redirect `/a/`: its target `/nowhere/` is not a page of the site',
			'redirect `/b/`: its target `/a/` is itself a redirect; point it at the final page',
			'redirect `/c/`: its target `/guide/install/#nope` has no id "nope"',
		]);
	});

	it('lists the social links, and reports one that is not a URL', async () => {
		const s = await site({
			socialLinks: [
				{icon: 'github', link: 'https://github.com/o/r'},
				{label: 'Chat', link: 'https://chat.example.com'},
				{icon: 'github', link: '/relative/'},
			],
		});
		expect(s.manifest().socialLinks.slice(0, 2)).toEqual([
			{icon: 'github', label: 'github', link: 'https://github.com/o/r'},
			{icon: null, label: 'Chat', link: 'https://chat.example.com'},
		]);
		expect(s.check().map((p) => p.message)).toEqual([
			'socialLinks: `/relative/` is not an http(s) URL',
		]);
	});

	it('resolves frontmatter links to site paths', async () => {
		const s = await site({base: '/docs/'});
		const code = s.moduleCode(join(root, 'index.md'))!;
		expect(code).toContain('"link":"/docs/guide/"');
	});

	it('gives articles their layout and dates', async () => {
		const m = (await site()).manifest();
		expect(m.articles).toBe('/news/');
		expect(
			m.pages.find((p) => p.route === '/news/2026-01-02-b/'),
		).toMatchObject({
			layout: 'article',
			date: '2026-01-02',
		});
	});
});

describe('navigation', () => {
	it('finds the section, the trail and the neighbours of a page', async () => {
		const m = (await site()).manifest();
		expect(findSection(m, '/guide/advanced/tuning/')?.dir).toBe('guide');
		expect(breadcrumb(m, '/guide/advanced/tuning/')).toEqual([
			{text: 'Guide', link: '/guide/'},
			{text: 'Advanced', link: '/guide/advanced/'},
			{text: 'Tuning', link: '/guide/advanced/tuning/'},
		]);
		expect(neighbours(m, '/guide/install/')).toEqual({
			prev: {text: 'Guide', link: '/guide/'},
			next: {text: 'Advanced', link: '/guide/advanced/'},
		});
	});
});
