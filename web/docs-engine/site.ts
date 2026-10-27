/**
 * The whole content folder: which files are pages, what each renders to, the
 * manifest the site navigates by, and whether every link lands.
 *
 * Kept free of Vite so it can be driven by the plugin, by the post-build step
 * and by tests alike.
 */
import {existsSync, globSync, readFileSync, statSync} from 'node:fs';
import {join, posix, relative, sep} from 'node:path';
import type {ResolvedDocsConfig} from './config.js';
import type {
	DocModule,
	DocsManifest,
	Layout,
	PageMeta,
	Section,
} from '../src/lib/core/docs/types.js';
import {flattenLinks} from '../src/lib/core/docs/navigation.js';
import {
	renderMarkdown,
	splitFrontmatter,
	type RenderResult,
} from './markdown/render.js';
import {resolveLink} from './markdown/links.js';
import {generateSidebar, humanise, readNavFile} from './sidebar.js';

export type Mode = 'dev' | 'build';

export type Problem = {source: string; line: number | null; message: string};

type Entry = {
	source: string;
	file: string;
	route: string;
	text: string;
	result: RenderResult;
	meta: PageMeta;
};

const LAYOUTS: Layout[] = ['doc', 'home', 'page', 'article'];

/** `guide/install.md` -> `guide/install`; `guide/index.md` -> `guide`. */
export function routePathOf(source: string): string {
	const noExt = source.replace(/\.md$/i, '');
	const parts = noExt.split('/');
	const last = parts.at(-1)!.toLowerCase();
	if (last === 'index' || last === 'readme') parts.pop();
	return parts.join('/');
}

function toPosix(path: string): string {
	return path.split(sep).join('/');
}

function dateOf(value: unknown): string | null {
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	if (typeof value === 'string' && value.trim()) {
		const iso = value.trim().match(/^\d{4}-\d{2}-\d{2}/);
		return iso ? iso[0] : value.trim();
	}
	return null;
}

function stringOr(value: unknown, fallback: string): string {
	return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export class DocsSite {
	readonly config: ResolvedDocsConfig;
	readonly mode: Mode;
	private entries = new Map<string, Entry>();
	/** Site paths the content may link to that are not Markdown pages. */
	private extraRoutes = new Set<string>();
	private sources = new Map<string, string>();
	private routeSet = new Set<string>();
	problems: Problem[] = [];
	private cachedManifest: DocsManifest | null = null;

	constructor(config: ResolvedDocsConfig, mode: Mode) {
		this.config = config;
		this.mode = mode;
	}

	/** Content-relative path of an absolute file, or null if outside. */
	sourceOf(file: string): string | null {
		const rel = toPosix(relative(this.config.contentRoot, file));
		if (rel.startsWith('..') || rel.startsWith('/')) return null;
		return rel;
	}

	/** Whether an absolute path is one of the pages. */
	hasFile(file: string): boolean {
		const source = this.sourceOf(file);
		return source !== null && this.entries.has(source);
	}

	/** Whether a change to this absolute path can affect the site. */
	isWatched(file: string): boolean {
		const source = this.sourceOf(file);
		if (source === null) return false;
		if (this.entries.has(source)) return true;
		if (source.endsWith(this.config.navFile)) return true;
		return /\.md$/i.test(source) && this.isIncluded(source);
	}

	private isIncluded(source: string): boolean {
		return this.scan().includes(source);
	}

	/** Content-relative paths of every page file, sorted. */
	scan(): string[] {
		const {contentRoot, include, exclude, publicDir} = this.config;
		if (!existsSync(contentRoot)) {
			throw new Error(`docs: content folder not found: ${contentRoot}`);
		}
		const always = ['**/node_modules', '**/.*'];
		if (publicDir) always.push(publicDir);
		return globSync(include, {
			cwd: contentRoot,
			exclude: [...always, ...exclude],
		})
			.map(toPosix)
			.filter((p) => /\.md$/i.test(p))
			.filter((p) => statSync(join(contentRoot, p)).isFile())
			.sort();
	}

	/** Folders the dev server must watch: the static prefix of each include. */
	watchRoots(): string[] {
		const roots = new Set<string>();
		for (const pattern of this.config.include) {
			const prefix: string[] = [];
			for (const part of pattern.split('/')) {
				if (/[*?[\]{}!]/.test(part)) break;
				prefix.push(part);
			}
			roots.add(join(this.config.contentRoot, ...prefix));
		}
		if (this.config.publicRoot) roots.add(this.config.publicRoot);
		return [...roots];
	}

	/** Read and render everything. */
	async load(): Promise<void> {
		this.sources.clear();
		const routes = new Map<string, string>();
		for (const source of this.scan()) {
			// Drafts are left out of a build BEFORE anything is rendered, so a
			// link to one is a dead link like any other, reported with its file
			// and line rather than discovered by the prerender crawl.
			if (this.mode === 'build' && this.isDraft(source)) continue;
			const route = posix.join(this.config.base, routePathOf(source), '/');
			const existing = routes.get(route);
			if (existing) {
				// `index.md` beats `README.md` in the same folder.
				if (/readme\.md$/i.test(source)) continue;
				this.sources.delete(existing);
			}
			routes.set(route, source);
			this.sources.set(source, route);
		}
		this.extraRoutes = new Set<string>();
		if (this.config.articles) {
			this.extraRoutes.add(
				posix.join(this.config.base, this.config.articles, '/'),
			);
			// The feed is a site route, outside the content's mount point.
			this.extraRoutes.add('/feed.xml');
		}
		this.routeSet = new Set([...this.sources.values(), ...this.extraRoutes]);

		const next = new Map<string, Entry>();
		for (const [source, route] of this.sources) {
			next.set(source, await this.renderEntry(source, route));
		}
		this.entries = next;
		this.cachedManifest = null;
	}

	/**
	 * Whether a page is a draft (`draft: true`): shown by the dev server,
	 * absent from a build. Unreadable frontmatter is not a draft; rendering
	 * the page reports the error.
	 */
	private isDraft(source: string): boolean {
		try {
			const text = readFileSync(join(this.config.contentRoot, source), 'utf8');
			return splitFrontmatter(text).data.draft === true;
		} catch {
			return false;
		}
	}

	private linkContext(source: string, route: string) {
		const {base, contentRoot, publicRoot} = this.config;
		return {
			route,
			source,
			base,
			contentRoot,
			routeOfSource: (s: string) => this.sources.get(s) ?? null,
			isRoute: (p: string) => this.routeSet.has(p),
			isPublicFile: (p: string) => {
				if (!publicRoot) return false;
				const file = join(publicRoot, p);
				return existsSync(file) && statSync(file).isFile();
			},
		};
	}

	private async renderEntry(source: string, route: string): Promise<Entry> {
		const file = join(this.config.contentRoot, source);
		const text = readFileSync(file, 'utf8');
		let result: RenderResult;
		try {
			result = await renderMarkdown(text, {
				themes: this.config.codeThemes,
				links: this.linkContext(source, route),
			});
		} catch (error) {
			throw new Error(
				`docs: failed to render ${source}: ${(error as Error).message}`,
			);
		}
		this.resolveFrontmatterLinks(result, source, route);
		const fm = result.frontmatter;
		const section = source.includes('/') ? source.split('/')[0] : null;
		const isArticle =
			!!this.config.articles &&
			section === this.config.articles &&
			routePathOf(source) !== this.config.articles;
		const layout = LAYOUTS.includes(fm.layout as Layout)
			? (fm.layout as Layout)
			: isArticle
				? 'article'
				: 'doc';
		const fileName = humanise(routePathOf(source).split('/').at(-1) || 'home');
		const meta: PageMeta = {
			route,
			source,
			// A home page often has no heading of its own: its hero names it.
			title: stringOr(
				fm.title,
				result.headingTitle ??
					stringOr((fm.hero as {name?: unknown} | undefined)?.name, fileName),
			),
			sidebarTitle:
				typeof fm.sidebarTitle === 'string' ? fm.sidebarTitle : null,
			order: typeof fm.order === 'number' ? fm.order : null,
			section,
			layout,
			date: dateOf(fm.date),
			description: stringOr(fm.description, result.excerpt),
			image: typeof fm.image === 'string' ? fm.image : null,
			toc: fm.toc !== false,
			editLink: fm.editLink !== false,
		};
		return {source, file, route, text, result, meta};
	}

	/**
	 * Links and images in frontmatter (`image`, and on a home page
	 * `hero.actions[].link`, `features[].link`, `hero.image`) are written like
	 * any other link, so they are resolved to site paths and checked the same
	 * way.
	 */
	private resolveFrontmatterLinks(
		result: RenderResult,
		source: string,
		route: string,
	): void {
		const ctx = this.linkContext(source, route);
		const fix = (value: unknown, where: string): unknown => {
			if (typeof value !== 'string' || !value) return value;
			const target = resolveLink(value, ctx);
			const record = {href: value, line: null, anchor: null, dead: null};
			switch (target.kind) {
				case 'page':
					if (target.hash.length > 1) {
						result.links.push({
							...record,
							anchor: {
								route: target.route,
								id: decodeURIComponent(target.hash.slice(1)),
							},
						});
					}
					return target.route + target.query + target.hash;
				case 'asset':
					return target.sitePath + target.query + target.hash;
				case 'dead':
					result.links.push({
						...record,
						dead: `${target.reason} (frontmatter ${where})`,
					});
					return value;
				default:
					return value;
			}
		};
		const fm = result.frontmatter as Record<string, any>;
		if (typeof fm.image === 'string') fm.image = fix(fm.image, 'image');
		const hero = fm.hero;
		if (hero && typeof hero === 'object') {
			if (Array.isArray(hero.actions)) {
				for (const action of hero.actions) {
					if (action && typeof action === 'object') {
						action.link = fix(action.link, 'hero.actions');
					}
				}
			}
			const image = hero.image;
			if (typeof image === 'string')
				hero.image = {src: fix(image, 'hero.image')};
			else if (image && typeof image === 'object') {
				for (const key of ['src', 'light', 'dark']) {
					if (key in image) image[key] = fix(image[key], 'hero.image');
				}
			}
		}
		if (Array.isArray(fm.features)) {
			for (const feature of fm.features) {
				if (feature && typeof feature === 'object' && 'link' in feature) {
					feature.link = fix(feature.link, 'features');
				}
			}
		}
	}

	/**
	 * Re-render after a file changed. Returns whether the change is
	 * STRUCTURAL (anything in the manifest moved: a title, an order, a page
	 * added or removed), which the dev server answers with a full reload; a
	 * body-only edit is hot-swapped instead.
	 */
	async update(file: string): Promise<{structural: boolean}> {
		const before = JSON.stringify(this.manifest());
		const source = this.sourceOf(file);
		const entry = source ? this.entries.get(source) : undefined;
		const exists = existsSync(file);
		if (
			entry &&
			exists &&
			!source!.endsWith(this.config.navFile) &&
			readFileSync(file, 'utf8') !== entry.text
		) {
			const updated = await this.renderEntry(entry.source, entry.route);
			this.entries.set(entry.source, updated);
			this.cachedManifest = null;
		} else {
			await this.load();
		}
		return {structural: JSON.stringify(this.manifest()) !== before};
	}

	pages(): Entry[] {
		return [...this.entries.values()].sort((a, b) =>
			a.route.localeCompare(b.route),
		);
	}

	entryForFile(file: string): Entry | undefined {
		const source = this.sourceOf(file);
		return source ? this.entries.get(source) : undefined;
	}

	manifest(): DocsManifest {
		if (this.cachedManifest) return this.cachedManifest;
		this.problems = [];
		const pages = this.pages().map((e) => e.meta);
		const {articles, base, editLink} = this.config;

		const dirs = new Set(
			pages.map((p) => p.section).filter((s): s is string => !!s),
		);
		const configured = this.config.sections.map((s) => s.dir);
		const order = [
			...configured.filter((d) => dirs.has(d)),
			...(configured.length ? [] : [...dirs].sort()),
		];
		const sections: Section[] = [];
		for (const dir of [
			...order,
			...[...dirs].filter((d) => !order.includes(d)),
		]) {
			const route = posix.join(base, dir, '/');
			const index = pages.find((p) => p.route === route);
			const label =
				this.config.sections.find((s) => s.dir === dir)?.label ??
				index?.title ??
				humanise(dir);
			const sidebar = dir === articles ? [] : this.sidebarOf(dir, pages);
			const first = flattenLinks(sidebar)[0];
			sections.push({
				dir,
				route,
				label,
				link: index || dir === articles ? route : (first ?? route),
				sidebar,
				nav: order.includes(dir),
			});
		}

		this.cachedManifest = {
			base,
			pages,
			sections,
			articles: articles ? posix.join(base, articles, '/') : null,
			editLink: editLink
				? {
						pattern: `${editLink.repo.replace(/\/$/, '')}/edit/${editLink.branch ?? 'main'}/${
							editLink.dir ? `${editLink.dir.replace(/^\/|\/$/g, '')}/` : ''
						}{path}`,
						text: editLink.text ?? 'Edit this page on GitHub',
					}
				: null,
		};
		return this.cachedManifest;
	}

	private sidebarOf(dir: string, pages: PageMeta[]) {
		const navSource = `${dir}/${this.config.navFile}`;
		const navFile = join(this.config.contentRoot, navSource);
		if (!existsSync(navFile)) return generateSidebar(dir, pages);
		const errors: {message: string}[] = [];
		const ctx = this.linkContext(
			navSource,
			posix.join(this.config.base, dir, '/'),
		);
		const items = readNavFile(
			readFileSync(navFile, 'utf8'),
			(link) => {
				const target = resolveLink(link, ctx);
				return target.kind === 'page' ? target.route + target.hash : null;
			},
			errors,
		);
		for (const e of errors) {
			this.problems.push({source: navSource, line: null, message: e.message});
		}
		return items;
	}

	/** Dead links and anchors across the site, plus anything else to report. */
	check(): Problem[] {
		this.manifest(); // fills this.problems with nav file errors
		const problems: Problem[] = [...this.problems];
		const idsByRoute = new Map<string, Set<string>>();
		for (const entry of this.entries.values()) {
			idsByRoute.set(entry.route, new Set(entry.result.ids));
		}
		for (const entry of this.entries.values()) {
			for (const warning of entry.result.warnings) {
				problems.push({source: entry.source, line: null, message: warning});
			}
			for (const link of entry.result.links) {
				if (link.dead) {
					problems.push({
						source: entry.source,
						line: link.line,
						message: `dead link \`${link.href}\`: ${link.dead}`,
					});
				} else if (link.anchor) {
					const ids = idsByRoute.get(link.anchor.route);
					// Routes that are not Markdown pages (the article list, the
					// feed) are not checked for ids here; the prerender crawl is.
					if (ids && !ids.has(link.anchor.id)) {
						problems.push({
							source: entry.source,
							line: link.line,
							message: `missing anchor \`${link.href}\`: no id "${link.anchor.id}" on ${link.anchor.route}`,
						});
					}
				}
			}
		}
		return problems;
	}

	/** The module a `.md` file compiles to. */
	moduleCode(file: string): string | null {
		const entry = this.entryForFile(file);
		if (!entry) return null;
		const {result, meta} = entry;
		const imports = result.assets.map(
			(a, i) => `import __docs_asset_${i} from ${JSON.stringify(a.file)};`,
		);
		let html = JSON.stringify(result.html);
		result.assets.forEach((a, i) => {
			html = html.split(a.placeholder).join(`" + __docs_asset_${i} + "`);
		});
		const page: Omit<DocModule, 'html'> = {
			route: meta.route,
			frontmatter: result.frontmatter,
			title: meta.title,
			hasH1: result.hasH1,
			headings: result.headings,
			order: meta.order,
		};
		const fields = Object.entries(page)
			.map(([k, v]) => `export const ${k} = ${JSON.stringify(v)};`)
			.join('\n');
		return `${imports.join('\n')}
export const html = ${html};
${fields}
const page = {html, route, frontmatter, title, hasH1, headings, order};
export default page;
if (import.meta.hot) {
	// Self-accepting: an edit to the body swaps the page in place, without a
	// reload. The page listens for this event (see core/docs/live.ts).
	import.meta.hot.accept((next) => {
		if (next && typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('docs:page-update', {detail: next.default}));
		}
	});
}
`;
	}

	/** The virtual module: the manifest, and a loader per page. */
	manifestCode(): string {
		const loaders = this.pages()
			.map(
				(e) =>
					`\t${JSON.stringify(e.route)}: () => import(${JSON.stringify(e.file)}),`,
			)
			.join('\n');
		return `export const manifest = ${JSON.stringify(this.manifest())};
export const loaders = {
${loaders}
};
`;
	}
}
