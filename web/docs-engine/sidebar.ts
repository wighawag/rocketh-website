/**
 * The sidebar of each section: generated from the folder tree and sorted by
 * `order` frontmatter, unless the section has a nav file (`_sidebar.yaml`)
 * that spells it out.
 */
import {posix} from 'node:path';
import {parse as parseYaml} from 'yaml';
import type {NavItem, PageMeta} from '../src/lib/core/docs/types.js';

/** `getting-started` -> `Getting started`. */
export function humanise(name: string): string {
	const words = name.replace(/[-_]+/g, ' ').trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

type Sortable = NavItem & {sortOrder: number | null};

/**
 * Pages with an `order` come first, lowest first; pages without one follow,
 * alphabetically by their label. Ties on `order` are also alphabetical.
 */
function byOrder(a: Sortable, b: Sortable): number {
	const ao = a.sortOrder ?? Number.POSITIVE_INFINITY;
	const bo = b.sortOrder ?? Number.POSITIVE_INFINITY;
	if (ao !== bo) return ao < bo ? -1 : 1;
	return a.text.localeCompare(b.text);
}

function strip(items: Sortable[]): NavItem[] {
	return items.map(({sortOrder: _, ...item}) => item);
}

/** The folder a page "owns": its own for an index page, else its parent. */
function isIndex(page: PageMeta): boolean {
	return /(^|\/)(index|readme)\.md$/i.test(page.source);
}

/**
 * Generate a section's sidebar from its pages.
 *
 * - The section's index page comes first.
 * - A page is a link. A folder with an index page is a link too, whose
 *   children are the pages inside it; a folder without one is a plain group
 *   labelled from the folder name.
 */
export function generateSidebar(
	sectionDir: string,
	pages: PageMeta[],
): NavItem[] {
	const inSection = pages.filter((p) => p.source.startsWith(`${sectionDir}/`));

	function itemsOf(dir: string): NavItem[] {
		const out: Sortable[] = [];
		const folders = new Set<string>();
		for (const page of inSection) {
			const pageDir = posix.dirname(page.source);
			if (pageDir === dir && !isIndex(page)) {
				out.push({
					text: page.sidebarTitle ?? page.title,
					link: page.route,
					sortOrder: page.order,
				});
			} else if (pageDir.startsWith(`${dir}/`)) {
				folders.add(pageDir.slice(dir.length + 1).split('/')[0]);
			}
		}
		for (const folder of folders) {
			const path = `${dir}/${folder}`;
			const index = inSection.find(
				(p) => isIndex(p) && posix.dirname(p.source) === path,
			);
			const children = itemsOf(path);
			const item: Sortable = index
				? {
						text: index.sidebarTitle ?? index.title,
						link: index.route,
						sortOrder: index.order,
					}
				: {text: humanise(folder), sortOrder: null};
			if (children.length) item.items = children;
			if (item.link || item.items) out.push(item);
		}
		return strip(out.sort(byOrder));
	}

	const index = inSection.find(
		(p) => isIndex(p) && posix.dirname(p.source) === sectionDir,
	);
	const items = itemsOf(sectionDir);
	return index
		? [{text: index.sidebarTitle ?? index.title, link: index.route}, ...items]
		: items;
}

export type NavFileError = {message: string};

/**
 * Read a nav file. Its shape is VitePress's sidebar config:
 *
 *     - text: Introduction
 *       link: /guide/
 *     - text: Getting started
 *       collapsed: false
 *       items:
 *         - text: Install
 *           link: install.md
 *
 * A `link` may be content-absolute (`/guide/install/`), relative to the
 * section folder (`install/`), or name the Markdown file (`install.md`).
 * `resolve` maps it to a site path, or returns null when nothing is there.
 */
export function readNavFile(
	source: string,
	resolve: (link: string) => string | null,
	errors: NavFileError[],
): NavItem[] {
	const data = parseYaml(source);
	const list = Array.isArray(data) ? data : data?.items;
	if (!Array.isArray(list)) {
		errors.push({message: 'expected a list of items (or `items:`)'});
		return [];
	}
	function convert(raw: unknown): NavItem | null {
		if (!raw || typeof raw !== 'object') return null;
		const entry = raw as Record<string, unknown>;
		const item: NavItem = {text: String(entry.text ?? '')};
		if (typeof entry.link === 'string') {
			const external = /^[a-z][a-z0-9+.-]*:|^\/\//i.test(entry.link);
			const link = external ? entry.link : resolve(entry.link);
			if (link) item.link = link;
			else errors.push({message: `no page for link \`${entry.link}\``});
		}
		if (!item.text) errors.push({message: 'an item has no `text`'});
		if (Array.isArray(entry.items)) {
			item.items = entry.items
				.map(convert)
				.filter((i): i is NavItem => i !== null);
		}
		if (typeof entry.collapsed === 'boolean') item.collapsed = entry.collapsed;
		return item;
	}
	return list.map(convert).filter((i): i is NavItem => i !== null);
}
