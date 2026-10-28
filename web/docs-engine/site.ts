/**
 * The whole content folder: which files are pages, what each renders to, the
 * manifest the site navigates by, and whether every link lands.
 *
 * Kept free of Vite so it can be driven by the plugin, by the post-build step
 * and by tests alike.
 */
import {existsSync, globSync, readFileSync, statSync} from 'node:fs';
import {join, posix, relative, sep} from 'node:path';
import {
	normaliseBase,
	type EditLinkConfig,
	type ResolvedDocsConfig,
} from './config.js';
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
import {parse as parseYaml} from 'yaml';
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

/** `file` relative to `root`, in posix form, or null when it is outside. */
function within(root: string, file: string): string | null {
	const rel = toPosix(relative(root, file));
	if (rel.startsWith('..') || rel.startsWith('/')) return null;
	return rel;
}

/** The `.md` files of a folder matching the globs, folder-relative. */
function markdownFiles(
	root: string,
	include: string[],
	exclude: string[],
): string[] {
	return globSync(include, {cwd: root, exclude})
		.map(toPosix)
		.filter((p) => /\.md$/i.test(p))
		.filter((p) => statSync(join(root, p)).isFile());
}

/** An `editLink` setting as the manifest holds it: a `{path}` pattern. */
function editLinkOf(editLink: EditLinkConfig | null): DocsManifest['editLink'] {
	if (!editLink) return null;
	const dir = editLink.dir ? `${editLink.dir.replace(/^\/|\/$/g, '')}/` : '';
	return {
		pattern: `${editLink.repo.replace(/\/$/, '')}/edit/${editLink.branch ?? 'main'}/${dir}{path}`,
		text: editLink.text ?? 'Edit this page on GitHub',
	};
}

export class DocsSite {
	readonly config: ResolvedDocsConfig;
	readonly mode: Mode;
	private entries = new Map<string, Entry>();
	/** Site paths the content may link to that are not Markdown pages. */
	private extraRoutes = new Set<string>();
	private sources = new Map<string, string>();
	private routeSet = new Set<string>();
	/** Old site path -> where it forwards to, both normalised. */
	private redirectMap = new Map<string, string>();
	/** Old site path -> anchor id -> where that anchor forwards to. */
	private redirectAnchorMap = new Map<string, Map<string, string>>();
	/** Which file each redirect key came from, for its problems. */
	private redirectSources = new Map<string, string>();
	private redirectProblems: {source: string; message: string}[] = [];
	problems: Problem[] = [];
	private cachedManifest: DocsManifest | null = null;

	constructor(config: ResolvedDocsConfig, mode: Mode) {
		this.config = config;
		this.mode = mode;
	}

	/**
	 * Content-relative path of an absolute file, or null if outside.
	 *
	 * Articles from a folder of their own (`articles.contentDir`) are given the
	 * source they would have as the content directory's `<dir>/` folder:
	 * `<dir>/hello.md`. Everything keyed by source (routes, sections, links,
	 * the article layout) then treats them like any other article, and
	 * `fileOf` is the one place that knows where they really are.
	 */
	sourceOf(file: string): string | null {
		const {contentRoot, articlesSource: articles} = this.config;
		const rel = within(contentRoot, file);
		if (!articles?.root) return rel;
		const own = within(articles.root, file);
		// When one folder holds the other, a file belongs to the deeper one.
		if (
			own !== null &&
			(rel === null || articles.root.length > contentRoot.length)
		) {
			return own ? `${articles.dir}/${own}` : null;
		}
		// The content directory's own `<dir>/` folder is not read when the
		// articles come from elsewhere.
		if (rel === null || this.isArticleSource(rel)) return null;
		return rel;
	}

	/** Absolute path of a content-relative source, the inverse of `sourceOf`. */
	fileOf(source: string): string {
		const articles = this.config.articlesSource;
		if (articles?.root && this.isArticleSource(source)) {
			return join(articles.root, source.slice(articles.dir.length + 1));
		}
		return join(this.config.contentRoot, source);
	}

	private isArticleSource(source: string): boolean {
		const dir = this.config.articlesSource?.dir;
		return !!dir && source.startsWith(`${dir}/`);
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
		if (this.config.redirectsFile && source === this.config.redirectsFile) {
			return true;
		}
		return /\.md$/i.test(source) && this.isIncluded(source);
	}

	private isIncluded(source: string): boolean {
		return this.scan().includes(source);
	}

	/** Content-relative paths of every page file, sorted. */
	scan(): string[] {
		const {contentRoot, include, exclude, publicDir, articlesSource} =
			this.config;
		if (!existsSync(contentRoot)) {
			throw new Error(`docs: content folder not found: ${contentRoot}`);
		}
		const always = ['**/node_modules', '**/.*'];
		if (publicDir) always.push(publicDir);
		const pages = markdownFiles(contentRoot, include, [...always, ...exclude]);
		if (!articlesSource?.root) return pages.sort();
		const {dir, root} = articlesSource;
		if (!existsSync(root)) {
			throw new Error(`docs: articles folder not found: ${root}`);
		}
		// The articles' folder may hold the content directory, or the other way
		// round: each file is read from one place only, the one `sourceOf` says.
		return [
			...pages.filter((p) => this.sourceOf(join(contentRoot, p)) === p),
			...markdownFiles(root, articlesSource.include, always)
				.map((p) => `${dir}/${p}`)
				.filter((s) => this.sourceOf(this.fileOf(s)) === s),
		].sort();
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
		if (this.config.articlesSource?.root) {
			roots.add(this.config.articlesSource.root);
		}
		if (this.config.redirectsFile) {
			roots.add(join(this.config.contentRoot, this.config.redirectsFile));
		}
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
		this.loadRedirects();
		this.routeSet = new Set([
			...this.sources.values(),
			...this.extraRoutes,
			// An old address still works, so content linking to it is not dead.
			...this.redirectMap.keys(),
		]);

		const next = new Map<string, Entry>();
		for (const [source, route] of this.sources) {
			next.set(source, await this.renderEntry(source, route));
		}
		this.entries = next;
		this.cachedManifest = null;
	}

	/**
	 * Normalise the redirects, from the config's `redirects` and from the
	 * content's `redirectsFile`: keys to `/x/` shape, internal targets to a
	 * route plus an optional `#anchor`. A key with an `#anchor` forwards that
	 * one anchor of an old address somewhere else. Whether each target lands is
	 * decided by `check()`, once every page is known.
	 */
	private loadRedirects(): void {
		this.redirectMap = new Map();
		this.redirectAnchorMap = new Map();
		this.redirectSources = new Map();
		this.redirectProblems = [];
		const configSource = this.configSourceName();
		const entries: {from: string; to: unknown; source: string}[] =
			Object.entries(this.config.redirects ?? {}).map(([from, to]) => ({
				from,
				to,
				source: configSource,
			}));
		entries.push(...this.readRedirectsFile());

		const anchored: {from: string; to: unknown; source: string}[] = [];
		for (const entry of entries) {
			const {from, source} = entry;
			const problem = (message: string) =>
				this.redirectProblems.push({
					source,
					message: `redirect \`${from}\`: ${message}`,
				});
			if (
				typeof from !== 'string' ||
				!from.startsWith('/') ||
				from.includes('?')
			) {
				problem(
					'an old address must be a site path starting with `/`, without a query',
				);
				continue;
			}
			if (from.includes('#')) {
				anchored.push(entry);
				continue;
			}
			const key = normaliseBase(from);
			if (this.redirectMap.has(key)) {
				problem(
					`is listed twice (in ${this.redirectSources.get(key)} and ${source})`,
				);
				continue;
			}
			const target = this.normaliseRedirectTarget(entry.to, problem);
			if (target === null) continue;
			this.redirectMap.set(key, target);
			this.redirectSources.set(key, source);
		}

		// After every plain key is known, since an anchor may only be forwarded
		// from an address that is itself a redirect: a page that still exists
		// keeps its own anchors, and nothing runs to forward them.
		for (const entry of anchored) {
			const {from, source} = entry;
			const problem = (message: string) =>
				this.redirectProblems.push({
					source,
					message: `redirect \`${from}\`: ${message}`,
				});
			const h = from.indexOf('#');
			const key = normaliseBase(from.slice(0, h));
			const id = decodeURIComponent(from.slice(h + 1));
			if (!id) {
				problem('an anchor key needs an id after `#`');
				continue;
			}
			if (!this.redirectMap.has(key)) {
				problem(
					`\`${key}\` is not a redirect; an anchor can only be forwarded from an old address that is one`,
				);
				continue;
			}
			const anchors =
				this.redirectAnchorMap.get(key) ?? new Map<string, string>();
			if (anchors.has(id)) {
				problem('is listed twice');
				continue;
			}
			const target = this.normaliseRedirectTarget(entry.to, problem);
			if (target === null) continue;
			anchors.set(id, target);
			this.redirectAnchorMap.set(key, anchors);
			this.redirectSources.set(`${key}#${id}`, source);
		}
	}

	/** The config file's name, as problems name it. */
	private configSourceName(): string {
		return this.config.configFile.split(/[\\/]/).at(-1) ?? 'config';
	}

	/**
	 * The entries of the content's redirects file (`redirectsFile`), a YAML
	 * map of old address to new one, or none when the site has no such file.
	 * Keeping the table in the content means a page and the redirect that
	 * replaces it change in the same commit, even when the site's code lives in
	 * another repository.
	 */
	private readRedirectsFile(): {from: string; to: unknown; source: string}[] {
		const name = this.config.redirectsFile;
		if (!name) return [];
		const file = join(this.config.contentRoot, name);
		if (!existsSync(file)) return [];
		let data: unknown;
		try {
			data = parseYaml(readFileSync(file, 'utf8'));
		} catch (error) {
			this.redirectProblems.push({
				source: name,
				message: `cannot read the redirects: ${error instanceof Error ? error.message : String(error)}`,
			});
			return [];
		}
		if (data === null || data === undefined) return [];
		if (typeof data !== 'object' || Array.isArray(data)) {
			this.redirectProblems.push({
				source: name,
				message: 'the redirects must be a map of old address to new address',
			});
			return [];
		}
		return Object.entries(data as Record<string, unknown>).map(
			([from, to]) => ({
				from,
				to,
				source: name,
			}),
		);
	}

	/**
	 * A redirect's target as the manifest holds it: an http(s) URL as is, a
	 * site path as a route plus an optional `#anchor`. Null, with the problem
	 * reported, when it is neither.
	 */
	private normaliseRedirectTarget(
		to: unknown,
		problem: (message: string) => void,
	): string | null {
		if (typeof to !== 'string' || !to.trim()) {
			problem('no target');
			return null;
		}
		const target = to.trim();
		if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) {
			if (!/^https?:\/\//i.test(target)) {
				problem(`an external target must be an http(s) URL, not \`${target}\``);
				return null;
			}
			return target;
		}
		if (!target.startsWith('/')) {
			problem(
				`the target \`${target}\` must be a site path starting with \`/\`, or an http(s) URL`,
			);
			return null;
		}
		const h = target.indexOf('#');
		const path = h === -1 ? target : target.slice(0, h);
		const hash = h === -1 ? '' : target.slice(h);
		// A file route (`/feed.xml`) keeps its shape; a page gets its slash.
		const last = path.split('/').at(-1) ?? '';
		const route = last.includes('.') ? path : normaliseBase(path);
		return route + hash;
	}

	/** Problems with the redirects: a target that is not a page, and so on. */
	private checkRedirects(idsByRoute: Map<string, Set<string>>): Problem[] {
		const problems: Problem[] = this.redirectProblems.map(
			({source, message}) => ({
				source,
				line: null,
				message,
			}),
		);
		const pageRoutes = new Set([...this.sources.values(), ...this.extraRoutes]);
		const checkTarget = (
			from: string,
			to: string,
			report: (m: string) => void,
		) => {
			if (/^[a-z][a-z0-9+.-]*:/i.test(to)) return;
			const h = to.indexOf('#');
			const route = h === -1 ? to : to.slice(0, h);
			if (this.redirectMap.has(route)) {
				report(
					`its target \`${to}\` is itself a redirect; point it at the final page`,
				);
			} else if (!pageRoutes.has(route)) {
				report(`its target \`${to}\` is not a page of the site`);
			} else if (h !== -1) {
				const ids = idsByRoute.get(route);
				const id = decodeURIComponent(to.slice(h + 1));
				if (ids && !ids.has(id)) {
					report(`its target \`${to}\` has no id "${id}"`);
				}
			}
		};
		const reporter = (from: string) => (message: string) =>
			problems.push({
				source: this.redirectSources.get(from) ?? this.configSourceName(),
				line: null,
				message: `redirect \`${from}\`: ${message}`,
			});
		for (const [from, to] of this.redirectMap) {
			const report = reporter(from);
			if (pageRoutes.has(from)) {
				report(
					'is also a page; a page and a forwarding page cannot share an address',
				);
				continue;
			}
			checkTarget(from, to, report);
		}
		for (const [from, anchors] of this.redirectAnchorMap) {
			for (const [id, to] of anchors) {
				checkTarget(`${from}#${id}`, to, reporter(`${from}#${id}`));
			}
		}
		return problems;
	}

	/**
	 * Whether a page is a draft (`draft: true`): shown by the dev server,
	 * absent from a build. Unreadable frontmatter is not a draft; rendering
	 * the page reports the error.
	 */
	private isDraft(source: string): boolean {
		try {
			const text = readFileSync(this.fileOf(source), 'utf8');
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
			fileOf: (s: string) => this.fileOf(s),
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
		const file = this.fileOf(source);
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
		const {articles, articlesSource, base, editLink} = this.config;

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
			editLink: editLinkOf(editLink),
			articlesFolder: articlesSource?.root
				? {
						dir: articlesSource.dir,
						editLink: editLinkOf(articlesSource.editLink),
					}
				: null,
			redirects: Object.fromEntries(this.redirectMap),
			redirectAnchors: Object.fromEntries(
				[...this.redirectAnchorMap].map(([from, anchors]) => [
					from,
					Object.fromEntries(anchors),
				]),
			),
			socialLinks: (this.config.socialLinks ?? []).map((l) => ({
				link: l.link,
				icon: l.icon ?? null,
				label: l.label ?? l.icon ?? l.link,
			})),
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
		problems.push(...this.checkRedirects(idsByRoute));
		for (const l of this.config.socialLinks ?? []) {
			if (typeof l?.link !== 'string' || !/^https?:\/\//i.test(l.link)) {
				problems.push({
					source: this.config.configFile.split(/[\\/]/).at(-1) ?? 'config',
					line: null,
					message: `socialLinks: \`${l?.link}\` is not an http(s) URL`,
				});
			}
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
