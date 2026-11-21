import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {CodeBlock, CodeBlockActionHook} from '../../docs-engine/config.js';
import {resolveConfig} from '../../docs-engine/config.js';
import {renderMarkdown} from '../../docs-engine/markdown/render';
import {DocsSite} from '../../docs-engine/site';

const links = {
	route: '/page/',
	source: 'page.md',
	base: '/',
	contentRoot: '/nonexistent',
	routeOfSource: (s: string) => (s === 'other.md' ? '/other/' : null),
	isRoute: (p: string) => p === '/other/' || p === '/page/',
	isPublicFile: () => false,
};

function render(source: string, codeBlockAction?: CodeBlockActionHook) {
	return renderMarkdown(source, {
		themes: {light: 'github-light', dark: 'github-dark'},
		links,
		codeBlockAction,
	});
}

const PAGE = '# T\n\n```txt [notes]\na < b\n```\n\n```\nplain\n```\n';

// The HTML of PAGE before `codeBlockAction` existed: a site without the hook
// must keep getting exactly this.
const PAGE_HTML = [
	'<h1 id="t">T</h1>',
	'<div class="code-block" data-lang="txt" data-label="notes"><button type="button" class="code-copy" data-copy="" aria-label="Copy code" data-pagefind-ignore="">Copy</button><span class="code-lang" data-pagefind-ignore="" aria-hidden="true">notes</span><pre class="shiki shiki-themes github-light github-dark" style="background-color:#fff;--shiki-dark-bg:#24292e;color:#24292e;--shiki-dark:#e1e4e8" tabindex="0"><code><span class="line"><span>a &#x3C; b</span></span></code></pre></div>',
	'<div class="code-block" data-lang="text"><button type="button" class="code-copy" data-copy="" aria-label="Copy code" data-pagefind-ignore="">Copy</button><span class="code-lang" data-pagefind-ignore="" aria-hidden="true"></span><pre class="shiki shiki-themes github-light github-dark" style="background-color:#fff;--shiki-dark-bg:#24292e;color:#24292e;--shiki-dark:#e1e4e8" tabindex="0"><code><span class="line"><span>plain</span></span></code></pre></div>',
].join('\n');

describe('codeBlockAction in renderMarkdown', () => {
	it('leaves the HTML byte-identical without the hook', async () => {
		const r = await render(PAGE);
		expect(r.html).toBe(PAGE_HTML);
		expect(r.codeBlockActionErrors).toEqual([]);
	});

	it('leaves the HTML byte-identical when the hook returns nothing', async () => {
		const r = await render(PAGE, () => undefined);
		expect(r.html).toBe(PAGE_HTML);
		const n = await render(PAGE, () => null);
		expect(n.html).toBe(PAGE_HTML);
	});

	it('gives the hook each block with its language, info string, code and page', async () => {
		const seen: CodeBlock[] = [];
		await render(
			'```ts [deploy] playground=a/b.ts\nconst a = 1;\n```\n\n```\nplain\n```\n',
			(block) => void seen.push(block),
		);
		expect(seen).toEqual([
			{
				lang: 'ts',
				meta: '[deploy] playground=a/b.ts',
				source: 'const a = 1;',
				page: {source: 'page.md', route: '/page/'},
			},
			{
				lang: null,
				meta: null,
				source: 'plain',
				page: {source: 'page.md', route: '/page/'},
			},
		]);
	});

	it('renders a returned action as a link beside Copy, left out of search', async () => {
		const r = await render(
			'```ts run\nconst a = 1;\n```\n\n```ts\nconst b = 2;\n```\n',
			({meta}) =>
				meta === 'run'
					? {label: 'Run this', href: 'https://play.example/#x'}
					: undefined,
		);
		const [first, second] = r.html.split('<div class="code-block"').slice(1);
		expect(first).toContain(
			'<div class="code-actions" data-pagefind-ignore=""><a class="code-action" href="https://play.example/#x" data-pagefind-ignore="" target="_blank" rel="noreferrer">Run this</a><button type="button" class="code-copy" data-copy="" aria-label="Copy code" data-pagefind-ignore="">Copy</button></div>',
		);
		expect(second).not.toContain('code-action');
		expect(second).toMatch(/^ data-lang="ts"><button type="button"/);
	});

	it('rewrites and checks an internal action link like any other link', async () => {
		const r = await render(
			'Intro\n\n```ts\nconst a = 1;\n```\n\n```ts\nconst b = 2;\n```\n',
			({source}) =>
				source.includes('a')
					? {label: 'See', href: '/other/#x'}
					: {label: 'Gone', href: '/missing/'},
		);
		expect(r.html).toContain('<a class="code-action" href="../other/#x"');
		expect(r.links).toEqual([
			{
				href: '/other/#x',
				line: 3,
				anchor: {route: '/other/', id: 'x'},
				dead: null,
			},
			{href: '/missing/', line: 7, anchor: null, dead: expect.any(String)},
		]);
	});

	it('records a hook that throws, or returns something else, with the line', async () => {
		const r = await render(
			'Intro\n\n```ts\nboom\n```\n\n```ts\nodd\n```\n\n```ts\nfine\n```\n',
			({source}) => {
				if (source === 'boom') throw new Error('no example for this block');
				if (source === 'odd') return {label: '', href: 'x'};
				return undefined;
			},
		);
		expect(r.codeBlockActionErrors).toEqual([
			{line: 3, message: 'codeBlockAction threw: no example for this block'},
			{
				line: 7,
				message:
					'codeBlockAction must return nothing or `{label, href}` with two non-empty strings',
			},
		]);
		expect(r.html).not.toContain('code-action');
	});
});

describe('codeBlockAction in DocsSite', () => {
	let root: string;

	beforeAll(() => {
		root = mkdtempSync(join(tmpdir(), 'docs-code-actions-'));
		writeFileSync(
			join(root, 'index.md'),
			'---\ntitle: Home\n---\n\n# Home\n\n```ts\nok\n```\n\n::: tip\nA tip\n:::\n\n```ts\nboom\n```\n',
		);
	});

	afterAll(() => rmSync(root, {recursive: true, force: true}));

	async function site(codeBlockAction?: CodeBlockActionHook) {
		const config = resolveConfig(
			{contentDir: root, codeBlockAction},
			join(root, 'docs.config.js'),
		);
		const s = new DocsSite(config, 'build');
		await s.load();
		return s;
	}

	it('reports a throwing hook as a problem naming the page and line', async () => {
		const s = await site(({source}) => {
			if (source === 'boom') throw new Error('cannot link this block');
			return {label: 'Open', href: 'https://play.example/'};
		});
		expect(s.check()).toEqual([
			{
				source: 'index.md',
				line: 15,
				message: 'codeBlockAction threw: cannot link this block',
			},
		]);
	});

	it('changes nothing without the hook', async () => {
		const s = await site();
		expect(s.check()).toEqual([]);
		expect(s.pages()[0].result.html).not.toContain('code-action');
	});
});
