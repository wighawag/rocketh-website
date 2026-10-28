import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {resolveArticles, resolveConfig} from '../../docs-engine/config.js';
import {DocsSite} from '../../docs-engine/site';
import {searchDocument} from '../../docs-engine/search';
import {
	articles,
	editLink,
	emptyArticles,
} from '../../src/lib/core/docs/navigation';
import {renderFeed} from '../../src/lib/core/docs/feed';

// Articles from a folder of their own (`articles: {dir, contentDir}`): the
// docs come from one folder (another repository, typically), the articles
// from another, and the site treats them as one content tree.

let tmp: string;
let docsRoot: string;
let articlesRoot: string;

function write(root: string, files: Record<string, string>) {
	for (const [path, content] of Object.entries(files)) {
		const file = join(root, path);
		mkdirSync(dirname(file), {recursive: true});
		writeFileSync(file, content);
	}
}

async function site(
	articlesConfig: Record<string, unknown> = {},
	mode: 'dev' | 'build' = 'build',
	extra: Record<string, unknown> = {},
) {
	const config = resolveConfig(
		{
			contentDir: docsRoot,
			articles: {dir: 'news', contentDir: articlesRoot, ...articlesConfig},
			editLink: {repo: 'https://github.com/o/docs', dir: 'docs'},
			...extra,
		},
		join(tmp, 'site', 'docs.config.js'),
	);
	const s = new DocsSite(config, mode);
	await s.load();
	return s;
}

beforeAll(() => {
	tmp = mkdtempSync(join(tmpdir(), 'docs-articles-'));
	docsRoot = join(tmp, 'docs');
	articlesRoot = join(tmp, 'site', 'articles');
	write(docsRoot, {
		'index.md': '# Home\n\nRead [the news](/news/2026-02-01-hello/).\n',
		'guide/install.md': '# Install\n\n## Setup\n',
		// The content's own `news/` folder is left out: the articles come from
		// the articles folder.
		'news/stale.md': '# Stale\n',
	});
	write(articlesRoot, {
		'index.md': '# News\n\nWhat changed.\n',
		'2026-02-01-hello.md': [
			'---',
			'date: 2026-02-01',
			'title: Hello',
			'---',
			'',
			'See [setup](../guide/install.md#setup), [install](/guide/install/) and [the older one](./2025-12-24-older.md).',
			'',
			'![a picture](./picture.png)',
			'',
		].join('\n'),
		'2025-12-24-older.md': '---\ndate: 2025-12-24\n---\n# Older\n',
		'2026-03-01-draft.md': '---\ndate: 2026-03-01\ndraft: true\n---\n# Draft\n',
		'picture.png': 'not really a png',
		'node_modules/pkg/README.md': '# not an article\n',
	});
});

afterAll(() => rmSync(tmp, {recursive: true, force: true}));

describe('resolveArticles', () => {
	it('reads the string form as a folder of the content directory', () => {
		expect(resolveArticles('articles', '/site')).toEqual({
			dir: 'articles',
			root: null,
			include: [],
			editLink: null,
		});
		expect(resolveArticles({dir: '/articles/'}, '/site')?.dir).toBe('articles');
		expect(resolveArticles(null, '/site')).toBeNull();
	});

	it('resolves a folder of their own against the config file', () => {
		expect(
			resolveArticles({dir: 'articles', contentDir: '../articles'}, '/a/web'),
		).toEqual({
			dir: 'articles',
			root: '/a/articles',
			include: ['**/*.md'],
			editLink: null,
		});
	});

	it('refuses a dir that is not one folder name', () => {
		expect(() => resolveArticles({dir: 'a/b'}, '/site')).toThrow(/`dir`/);
		expect(() => resolveArticles({dir: ''} as never, '/site')).toThrow();
	});

	it('keeps `articles` as the folder name in the resolved config', () => {
		const config = resolveConfig(
			{articles: {dir: 'news', contentDir: '../news'}},
			'/a/web/docs.config.js',
		);
		expect(config.articles).toBe('news');
		expect(config.articlesSource?.root).toBe('/a/news');
	});
});

describe('articles from their own folder', () => {
	it('mounts them at `dir`, and leaves out the content directory`s own', async () => {
		const s = await site();
		expect(s.pages().map((p) => [p.route, p.source])).toEqual([
			['/', 'index.md'],
			['/guide/install/', 'guide/install.md'],
			['/news/', 'news/index.md'],
			['/news/2025-12-24-older/', 'news/2025-12-24-older.md'],
			['/news/2026-02-01-hello/', 'news/2026-02-01-hello.md'],
		]);
		expect(s.fileOf('news/2026-02-01-hello.md')).toBe(
			join(articlesRoot, '2026-02-01-hello.md'),
		);
		expect(s.sourceOf(join(articlesRoot, '2026-02-01-hello.md'))).toBe(
			'news/2026-02-01-hello.md',
		);
		expect(s.sourceOf(join(docsRoot, 'news', 'stale.md'))).toBeNull();
		expect(s.hasFile(join(articlesRoot, 'index.md'))).toBe(true);
		expect(s.watchRoots()).toContain(articlesRoot);
	});

	it('keeps drafts in dev only, as in the content directory', async () => {
		const dev = await site({}, 'dev');
		expect(dev.pages().map((p) => p.route)).toContain(
			'/news/2026-03-01-draft/',
		);
	});

	it('gives them the article layout, the list and the feed', async () => {
		const m = (await site()).manifest();
		expect(m.articles).toBe('/news/');
		const list = articles(m);
		expect(list.map((p) => [p.route, p.date])).toEqual([
			['/news/2026-02-01-hello/', '2026-02-01'],
			['/news/2025-12-24-older/', '2025-12-24'],
		]);
		const feed = renderFeed({
			title: 'Site',
			description: 'd',
			host: 'https://example.com',
			items: list,
		});
		expect(feed).toContain(
			'<link>https://example.com/news/2026-02-01-hello/</link>',
		);
		expect(m.pages.find((p) => p.route === '/news/')?.layout).toBe('doc');
	});

	it('are searchable like any page', async () => {
		const s = await site();
		const entry = s.pages().find((p) => p.route === '/news/2026-02-01-hello/');
		expect(entry).toBeDefined();
		// What the dev index is built from (see docs-engine/search.ts).
		expect(
			searchDocument(
				entry!.meta.title,
				entry!.result.html,
				entry!.result.hasH1,
			),
		).toContain('<h1>Hello</h1>');
	});

	it('resolves links in both directions, and their images', async () => {
		const s = await site();
		expect(s.check()).toEqual([]);
		const code = s.moduleCode(join(articlesRoot, '2026-02-01-hello.md'))!;
		expect(code).toContain('href=\\"../../guide/install/#setup\\"');
		expect(code).toContain('href=\\"../2025-12-24-older/\\"');
		expect(code).toContain(
			`import __docs_asset_0 from ${JSON.stringify(join(articlesRoot, 'picture.png'))};`,
		);
		const home = s.moduleCode(join(docsRoot, 'index.md'))!;
		expect(home).toContain('href=\\"./news/2026-02-01-hello/\\"');
	});

	it('reports a dead link or a missing anchor with the article`s file', async () => {
		write(articlesRoot, {
			'2026-01-10-broken.md':
				'---\ndate: 2026-01-10\n---\n# Broken\n\n[a](../guide/nope.md) [b](/guide/install/#nope)\n',
		});
		try {
			const messages = (await site())
				.check()
				.map((p) => `${p.source}: ${p.message}`);
			expect(messages).toEqual([
				'news/2026-01-10-broken.md: dead link `../guide/nope.md`: no such Markdown page',
				'news/2026-01-10-broken.md: missing anchor `/guide/install/#nope`: no id "nope" on /guide/install/',
			]);
		} finally {
			rmSync(join(articlesRoot, '2026-01-10-broken.md'));
		}
	});

	it('edits them in their own repository, and the docs in theirs', async () => {
		const m = (
			await site({
				editLink: {
					repo: 'https://github.com/o/site/',
					branch: 'dev',
					dir: '/articles/',
					text: 'Edit',
				},
			})
		).manifest();
		const page = (route: string) => m.pages.find((p) => p.route === route)!;
		expect(editLink(m, page('/news/2026-02-01-hello/'))).toEqual({
			href: 'https://github.com/o/site/edit/dev/articles/2026-02-01-hello.md',
			text: 'Edit',
		});
		expect(editLink(m, page('/guide/install/'))).toEqual({
			href: 'https://github.com/o/docs/edit/main/docs/guide/install.md',
			text: 'Edit this page on GitHub',
		});
	});

	it('has no edit link for them unless one is set', async () => {
		const m = (await site()).manifest();
		const article = m.pages.find((p) => p.route === '/news/2026-02-01-hello/')!;
		expect(m.articlesFolder).toEqual({dir: 'news', editLink: null});
		expect(editLink(m, article)).toBeNull();
	});

	it('reads each file once when one folder holds the other', async () => {
		// The articles folder is the parent of the docs folder: the docs stay
		// docs, and the articles are only what is not under them.
		const s = await site({
			contentDir: tmp,
			include: ['site/articles/*.md', 'docs/**/*.md'],
		});
		const routes = s.pages().map((p) => p.route);
		expect(routes).toContain('/news/site/articles/2026-02-01-hello/');
		expect(routes).toContain('/guide/install/');
		expect(routes.filter((r) => r.includes('/news/docs/'))).toEqual([]);
	});
});

describe('articles in the content directory (the string form)', () => {
	it('has no articles folder in the manifest', async () => {
		const s = new DocsSite(
			resolveConfig(
				{contentDir: docsRoot, articles: 'news'},
				join(tmp, 'c.js'),
			),
			'build',
		);
		await s.load();
		const m = s.manifest();
		expect(m.articlesFolder).toBeNull();
		expect(m.pages.find((p) => p.route === '/news/stale/')?.layout).toBe(
			'article',
		);
	});
});

describe('draft articles: kept in the repository, out of the build', () => {
	async function onlyDrafts(
		mode: 'dev' | 'build',
		files: Record<string, string>,
	) {
		const root = mkdtempSync(join(tmpdir(), 'docs-pending-'));
		write(root, {'index.md': '# Home\n', ...files});
		try {
			const s = new DocsSite(
				resolveConfig({contentDir: root, articles: 'news'}, join(root, 'c.js')),
				mode,
			);
			await s.load();
			return s.manifest();
		} finally {
			rmSync(root, {recursive: true, force: true});
		}
	}

	it('counts the drafts a build left out, and says they are coming', async () => {
		const m = await onlyDrafts('build', {
			'news/index.md': '---\ndraft: true\n---\n# News\n',
			'news/2026-01-01-soon.md':
				'---\ndate: 2026-01-01\ndraft: true\n---\n# Soon\n',
		});
		expect(m.pages.map((p) => p.route)).toEqual(['/']);
		// the folder's own index is not an article, draft or not
		expect(m.pendingArticles).toBe(1);
		expect(articles(m)).toEqual([]);
		expect(emptyArticles(m)).toBe('coming-soon');
	});

	it('says there are none when there is nothing at all', async () => {
		const m = await onlyDrafts('build', {'news/index.md': '# News\n'});
		expect(m.pendingArticles).toBe(0);
		expect(emptyArticles(m)).toBe('none');
	});

	it('has nothing to say when an article is published', async () => {
		const m = await onlyDrafts('build', {
			'news/2026-01-01-soon.md':
				'---\ndate: 2026-01-01\ndraft: true\n---\n# Soon\n',
			'news/2025-01-01-out.md': '---\ndate: 2025-01-01\n---\n# Out\n',
		});
		expect(m.pendingArticles).toBe(1);
		expect(emptyArticles(m)).toBeNull();
		expect(m.pages.every((p) => p.draft === false)).toBe(true);
	});

	it('shows drafts under the dev server, marked as drafts', async () => {
		const m = await onlyDrafts('dev', {
			'news/2026-01-01-soon.md':
				'---\ndate: 2026-01-01\ndraft: true\n---\n# Soon\n',
		});
		expect(m.pendingArticles).toBe(0);
		expect(articles(m).map((p) => [p.route, p.draft])).toEqual([
			['/news/2026-01-01-soon/', true],
		]);
		expect(emptyArticles(m)).toBeNull();
	});

	it('counts drafts in an articles folder of their own the same way', async () => {
		expect((await site()).manifest().pendingArticles).toBe(1);
	});
});
