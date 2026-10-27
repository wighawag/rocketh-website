/**
 * Where a link in the Markdown points, and how to write it in the page.
 *
 * Content links three ways, all of which must work:
 *   - site-absolute, the VitePress way: `/guide/install/`
 *   - relative: `../install/`, `./install.md#usage`
 *   - to the Markdown file itself (`install.md`), which is what reads well on
 *     GitHub
 * Absolute paths are relative to the CONTENT root, so `/guide/` means the
 * `guide` folder wherever the content is mounted. Relative paths resolve
 * against the source FILE, as they do on GitHub and in VitePress.
 *
 * Internal links are then written RELATIVE to the page (`../install/`), which
 * is what keeps the built site working under any base path and on IPFS, the
 * same reason `svelte.config.js` sets `paths.relative`.
 */
import {posix} from 'node:path';

export type LinkTarget =
	| {kind: 'page'; route: string; hash: string; query: string}
	| {kind: 'asset'; sitePath: string; hash: string; query: string}
	| {kind: 'external'}
	| {kind: 'hash'; id: string}
	| {kind: 'dead'; reason: string};

export type LinkContext = {
	/** This page's site path, e.g. `/guide/install/`. */
	route: string;
	/** This page's source, relative to the content root, e.g. `guide/install.md`. */
	source: string;
	/** Where the content is mounted, `/` or `/docs/`. */
	base: string;
	/** Site path of a source file (content-relative), or null if not a page. */
	routeOfSource: (source: string) => string | null;
	/** Whether a site path is a page (or another route the site serves). */
	isRoute: (sitePath: string) => boolean;
	/** Whether a content-relative path is a file in the public folder. */
	isPublicFile: (contentPath: string) => boolean;
};

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function split(href: string): {path: string; query: string; hash: string} {
	let path = href;
	let hash = '';
	let query = '';
	const h = path.indexOf('#');
	if (h !== -1) {
		hash = path.slice(h);
		path = path.slice(0, h);
	}
	const q = path.indexOf('?');
	if (q !== -1) {
		query = path.slice(q);
		path = path.slice(0, q);
	}
	return {path, query, hash};
}

function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

/** Classify an `href` (or `src`) found in a page. */
export function resolveLink(href: string, ctx: LinkContext): LinkTarget {
	if (href.startsWith('//') || SCHEME.test(href)) return {kind: 'external'};
	if (href.startsWith('#'))
		return {kind: 'hash', id: safeDecode(href.slice(1))};
	const {path, query, hash} = split(href);
	if (!path) return {kind: 'hash', id: safeDecode(hash.slice(1))};

	// Content-relative path of what the link names, before deciding what it is.
	const fromDir = posix.dirname(ctx.source);
	const contentPath = path.startsWith('/')
		? posix.normalize(path.slice(1))
		: posix.normalize(posix.join(fromDir === '.' ? '' : fromDir, path));
	if (contentPath.startsWith('..')) {
		return {kind: 'dead', reason: 'points outside the content folder'};
	}

	if (/\.md$/i.test(path)) {
		const route = ctx.routeOfSource(safeDecode(contentPath));
		return route
			? {kind: 'page', route, hash, query}
			: {kind: 'dead', reason: 'no such Markdown page'};
	}

	// A page path, with or without its trailing slash.
	const bare = contentPath === '.' ? '' : contentPath.replace(/\/$/, '');
	const sitePath = posix.join(ctx.base, bare, '/');
	if (ctx.isRoute(sitePath))
		return {kind: 'page', route: sitePath, hash, query};
	// A route that is a file rather than a folder, such as `/feed.xml`.
	const fileRoute = posix.join(ctx.base, bare);
	if (bare && ctx.isRoute(fileRoute)) {
		return {kind: 'page', route: fileRoute, hash, query};
	}
	// A route of the SITE rather than of the content, such as `/feed.xml`,
	// which stays at the site root when the content is mounted under a base.
	if (bare && ctx.base !== '/') {
		for (const siteRoute of [
			posix.join('/', bare, '/'),
			posix.join('/', bare),
		]) {
			if (ctx.isRoute(siteRoute)) {
				return {kind: 'page', route: siteRoute, hash, query};
			}
		}
	}

	if (bare && ctx.isPublicFile(safeDecode(bare))) {
		return {kind: 'asset', sitePath: posix.join(ctx.base, bare), hash, query};
	}
	return {kind: 'dead', reason: 'no page or public file at this path'};
}

/** `to` written relative to the page at `from` (both site paths). */
export function relativeUrl(from: string, to: string): string {
	const fromDir = from.endsWith('/') ? from : posix.dirname(from) + '/';
	let rel = posix.relative(fromDir, to);
	if (to.endsWith('/') && rel !== '') rel += '/';
	if (rel === '') return './';
	return rel.startsWith('.') ? rel : `./${rel}`;
}
