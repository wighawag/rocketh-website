/**
 * Where a page sits in the site: its section, its sidebar trail, the pages
 * before and after it. Pure functions over the manifest, so the components
 * only render what these return.
 */
import type {DocsManifest, NavItem, PageMeta, Section} from './types.js';

/** Every link of a sidebar, in reading order. */
export function flattenLinks(items: NavItem[]): string[] {
	const out: string[] = [];
	for (const item of items) {
		if (item.link) out.push(item.link);
		if (item.items) out.push(...flattenLinks(item.items));
	}
	return out;
}

/** Same page, whatever the caller did with the trailing slash. */
function samePath(a: string, b: string): boolean {
	return a.replace(/\/$/, '') === b.replace(/\/$/, '');
}

export function findPage(
	manifest: DocsManifest,
	route: string,
): PageMeta | undefined {
	return manifest.pages.find((p) => samePath(p.route, route));
}

/** The section a route belongs to: the one whose folder contains it. */
export function findSection(
	manifest: DocsManifest,
	route: string,
): Section | undefined {
	const withSlash = route.endsWith('/') ? route : `${route}/`;
	return manifest.sections.find((s) => withSlash.startsWith(s.route));
}

/** Whether an item is, or contains, the current page. */
export function containsRoute(item: NavItem, route: string): boolean {
	if (item.link && samePath(item.link, route)) return true;
	return (item.items ?? []).some((child) => containsRoute(child, route));
}

export type Crumb = {text: string; link?: string};

/** Section, then the sidebar groups that lead to the page, then the page. */
export function breadcrumb(manifest: DocsManifest, route: string): Crumb[] {
	const section = findSection(manifest, route);
	const page = findPage(manifest, route);
	if (!section) return page ? [{text: page.title}] : [];
	const trail: Crumb[] = [{text: section.label, link: section.link}];
	if (samePath(section.link, route)) return trail;
	function walk(items: NavItem[], path: Crumb[]): Crumb[] | null {
		for (const item of items) {
			const here = [...path, {text: item.text, link: item.link}];
			if (item.link && samePath(item.link, route)) return here;
			if (item.items) {
				const found = walk(item.items, here);
				if (found) return found;
			}
		}
		return null;
	}
	const found = walk(section.sidebar, []);
	// The section's own index is the sidebar's first entry; it is already
	// the first crumb.
	const path = (found ?? (page ? [{text: page.title}] : [])).filter(
		(c) => !(c.link && samePath(c.link, section.link)),
	);
	return [...trail, ...path];
}

export type Neighbour = {text: string; link: string};

/** The previous and next pages in the section's sidebar order. */
export function neighbours(
	manifest: DocsManifest,
	route: string,
): {prev: Neighbour | null; next: Neighbour | null} {
	const section = findSection(manifest, route);
	if (!section) return {prev: null, next: null};
	const links = flattenLinks(section.sidebar);
	const at = links.findIndex((l) => samePath(l, route));
	if (at === -1) return {prev: null, next: null};
	const label = (link: string): Neighbour => {
		const page = findPage(manifest, link);
		return {text: page?.sidebarTitle ?? page?.title ?? link, link};
	};
	return {
		prev: at > 0 ? label(links[at - 1]) : null,
		next: at < links.length - 1 ? label(links[at + 1]) : null,
	};
}

/** "Edit this page" for a page, when the site is configured for it. */
export function editLink(
	manifest: DocsManifest,
	page: PageMeta,
): {href: string; text: string} | null {
	if (!page.editLink) return null;
	const folder = manifest.articlesFolder;
	const own = !!folder && page.section === folder.dir;
	// An article from a folder of its own is edited in ITS repository.
	const edit = own ? folder.editLink : manifest.editLink;
	if (!edit) return null;
	const path = own ? page.source.slice(folder.dir.length + 1) : page.source;
	return {href: edit.pattern.replace('{path}', path), text: edit.text};
}

/** The articles, newest first. */
export function articles(manifest: DocsManifest): PageMeta[] {
	return manifest.pages
		.filter((p) => p.layout === 'article')
		.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}
