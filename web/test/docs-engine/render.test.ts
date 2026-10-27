import {describe, expect, it} from 'vitest';
import {renderMarkdown} from '../../docs-engine/markdown/render';

const links = {
	route: '/page/',
	source: 'page.md',
	base: '/',
	contentRoot: '/nonexistent',
	routeOfSource: (s: string) => (s === 'other.md' ? '/other/' : null),
	isRoute: (p: string) => p === '/other/' || p === '/page/',
	isPublicFile: () => false,
};

function render(source: string) {
	return renderMarkdown(source, {
		themes: {light: 'github-light', dark: 'github-dark'},
		links,
	});
}

describe('renderMarkdown', () => {
	it('reads frontmatter and takes the title from it, else the first h1', async () => {
		const a = await render(
			'---\ntitle: From frontmatter\norder: 2\n---\n# Heading',
		);
		expect(a.frontmatter).toEqual({title: 'From frontmatter', order: 2});
		expect(a.headingTitle).toBe('Heading');
		expect(a.hasH1).toBe(true);
	});

	it('counts a raw HTML h1 as the page heading', async () => {
		const r = await render('<h1>Raw title</h1>\n\nBody');
		expect(r.hasH1).toBe(true);
		expect(r.headingTitle).toBe('Raw title');
	});

	it('honours {#custom-id} and slugs the rest like GitHub', async () => {
		const r = await render('## Install it {#install}\n\n### What’s new?\n');
		expect(r.html).toContain('<h2 id="install">Install it</h2>');
		expect(r.headings).toEqual([
			{depth: 2, id: 'install', text: 'Install it'},
			{depth: 3, id: 'whats-new', text: 'What’s new?'},
		]);
	});

	it('renders containers in both forms', async () => {
		const spaced = await render('::: tip\nHello\n:::');
		const compact = await render(
			'Before\n::: danger Watch out\nHello\n:::\nAfter',
		);
		expect(spaced.html).toContain('class="callout callout-tip"');
		expect(compact.html).toContain('<p class="callout-title">Watch out</p>');
		expect(compact.html).toContain('<p>Before</p>');
		expect(compact.html).toContain('<p>After</p>');
	});

	it('renders GitHub alerts as callouts', async () => {
		const r = await render('> [!WARNING]\n> Careful');
		expect(r.html).toContain('callout-warning');
		expect(r.html).toContain('<p>Careful</p>');
	});

	it('turns a code group into tabs labelled from the fences', async () => {
		const r = await render(
			'::: code-group\n\n```bash [npm]\nnpm i\n```\n\n```bash [pnpm]\npnpm i\n```\n\n:::',
		);
		expect(r.html).toMatch(/role="tab"[^>]*>npm<\/button>/);
		expect(r.html).toMatch(/role="tab"[^>]*>pnpm<\/button>/);
		expect(r.html).toContain('hidden');
		expect(r.html).toContain('class="code-copy"');
	});

	it('leaves braces and colons in prose alone', async () => {
		const r = await render('A {brace}, a ratio of 16:9 and note:here.');
		expect(r.html).toContain('A {brace}, a ratio of 16:9 and note:here.');
	});

	it('turns ::component into an embed placeholder', async () => {
		const r = await render(
			'::component{name=Counter start=3 label="Hi there"}',
		);
		expect(r.html).toContain('data-embed="Counter"');
		expect(r.html).toContain(
			'data-props="{&#x22;start&#x22;:3,&#x22;label&#x22;:&#x22;Hi there&#x22;}"',
		);
	});

	it('keeps raw HTML, custom elements included', async () => {
		const r = await render('<my-widget size="2"></my-widget>');
		expect(r.html).toContain('<my-widget size="2"></my-widget>');
	});

	it('rewrites internal links relative to the page and records problems', async () => {
		const r = await render(
			'[a](/other/#x) [b](other.md) [c](/missing/) [d](#local)',
		);
		expect(r.html).toContain('href="../other/#x"');
		expect(r.html).toContain('href="../other/"');
		expect(r.links.filter((l) => l.dead).map((l) => l.href)).toEqual([
			'/missing/',
		]);
		expect(r.links.filter((l) => l.anchor).map((l) => l.anchor)).toEqual([
			{route: '/other/', id: 'x'},
			{route: '/page/', id: 'local'},
		]);
	});
});
