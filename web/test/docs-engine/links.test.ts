import {describe, expect, it} from 'vitest';
import {
	relativeUrl,
	resolveLink,
	type LinkContext,
} from '../../docs-engine/markdown/links';

const pages: Record<string, string> = {
	'index.md': '/',
	'guide/index.md': '/guide/',
	'guide/install.md': '/guide/install/',
	'guide/deep/index.md': '/guide/deep/',
};

function ctx(source: string, base = '/'): LinkContext {
	const prefixed = Object.fromEntries(
		Object.entries(pages).map(([s, r]) => [s, base + r.slice(1)]),
	);
	return {
		source,
		route: prefixed[source],
		base,
		routeOfSource: (s) => prefixed[s] ?? null,
		isRoute: (p) => Object.values(prefixed).includes(p),
		isPublicFile: (p) => p === 'logo.svg',
	};
}

describe('resolveLink', () => {
	it('reads site-absolute paths against the content root', () => {
		expect(resolveLink('/guide/install/', ctx('index.md'))).toMatchObject({
			kind: 'page',
			route: '/guide/install/',
		});
		expect(resolveLink('/guide/install', ctx('index.md'))).toMatchObject({
			kind: 'page',
			route: '/guide/install/',
		});
	});

	it('reads relative paths against the source file', () => {
		expect(
			resolveLink('../install/#usage', ctx('guide/deep/index.md')),
		).toMatchObject({
			kind: 'page',
			route: '/guide/install/',
			hash: '#usage',
		});
		expect(resolveLink('./install.md', ctx('guide/index.md'))).toMatchObject({
			kind: 'page',
			route: '/guide/install/',
		});
	});

	it('mounts content under a base path', () => {
		expect(resolveLink('/guide/', ctx('index.md', '/docs/'))).toMatchObject({
			kind: 'page',
			route: '/docs/guide/',
		});
	});

	it('knows public files, external links and anchors', () => {
		expect(resolveLink('/logo.svg', ctx('index.md'))).toMatchObject({
			kind: 'asset',
		});
		expect(resolveLink('https://example.com', ctx('index.md')).kind).toBe(
			'external',
		);
		expect(resolveLink('#x', ctx('index.md'))).toEqual({kind: 'hash', id: 'x'});
	});

	it('reports what does not exist', () => {
		expect(resolveLink('/nope/', ctx('index.md')).kind).toBe('dead');
		expect(resolveLink('missing.md', ctx('guide/index.md')).kind).toBe('dead');
		expect(resolveLink('../../outside/', ctx('guide/index.md')).kind).toBe(
			'dead',
		);
	});
});

describe('relativeUrl', () => {
	it('writes a site path relative to a page', () => {
		expect(relativeUrl('/guide/deep/', '/guide/install/')).toBe('../install/');
		expect(relativeUrl('/guide/', '/')).toBe('../');
		expect(relativeUrl('/', '/guide/')).toBe('./guide/');
		expect(relativeUrl('/guide/', '/guide/')).toBe('./');
		expect(relativeUrl('/a/b/', '/logo.svg')).toBe('../../logo.svg');
	});
});
