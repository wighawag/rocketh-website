/**
 * The Vite side of the docs engine.
 *
 * - `virtual:docs` exports `manifest` (every page's metadata, the sections and
 *   their sidebars) and `loaders` (a dynamic import per page).
 * - Each content `.md` file is a module (see `DocsSite.moduleCode`) exporting
 *   `html`, `frontmatter`, `title`, `hasH1`, `headings`, `order` and `route`.
 * - Under `vite dev`: an edit to a page body is hot-swapped; anything that
 *   changes the manifest reloads the page. The content's public folder and an
 *   in-memory Pagefind index are served too.
 * - Problems (dead links, missing anchors, bad nav files) are warnings in dev
 *   and fail `vite build`.
 */
import {createReadStream, existsSync, statSync} from 'node:fs';
import {extname, join, normalize} from 'node:path';
import {searchForWorkspaceRoot, type Plugin, type ViteDevServer} from 'vite';
import {loadDocsConfig, type ResolvedDocsConfig} from './config.js';
import {DocsSite, type Problem} from './site.js';
import {createDevSearch} from './search.js';

const VIRTUAL = 'virtual:docs';
const RESOLVED = `\0${VIRTUAL}`;

const MIME: Record<string, string> = {
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon',
	'.json': 'application/json',
	'.txt': 'text/plain',
	'.pdf': 'application/pdf',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.wasm': 'application/wasm',
};

export function formatProblems(problems: Problem[]): string {
	return problems
		.map((p) => `  ${p.source}${p.line ? `:${p.line}` : ''}  ${p.message}`)
		.join('\n');
}

export function docs(): Plugin {
	let config: ResolvedDocsConfig;
	let site: DocsSite | null = null;
	let loading: Promise<DocsSite> | null = null;
	let isBuild = false;
	let search: ReturnType<typeof createDevSearch> | null = null;
	/** One re-render per file change, however many environments ask. */
	const updates = new Map<string, Promise<{structural: boolean}>>();

	function getSite(): Promise<DocsSite> {
		loading ??= (async () => {
			const s = new DocsSite(config, isBuild ? 'build' : 'dev');
			await s.load();
			site = s;
			return s;
		})();
		return loading;
	}

	function report(problems: Problem[], server?: ViteDevServer) {
		if (!problems.length) return;
		const message = `docs: ${problems.length} problem(s) in the content:\n${formatProblems(problems)}`;
		if (isBuild) throw new Error(message);
		(server?.config.logger ?? console).warn(message);
	}

	return {
		name: 'docs',
		enforce: 'pre',

		async config(_, env) {
			isBuild = env.command === 'build';
			config = await loadDocsConfig();
			return {
				server: {
					fs: {
						// Setting `allow` replaces Vite's default, so the workspace
						// root goes back in alongside the content folder.
						allow: [searchForWorkspaceRoot(process.cwd()), config.contentRoot],
					},
				},
			};
		},

		async buildStart() {
			const s = await getSite();
			report(s.check());
		},

		resolveId(id) {
			if (id === VIRTUAL) return RESOLVED;
			if (site && id.endsWith('.md') && site.hasFile(id)) return id;
			return undefined;
		},

		async load(id) {
			if (id === RESOLVED) return (await getSite()).manifestCode();
			if (!id.endsWith('.md')) return undefined;
			const s = await getSite();
			const code = s.moduleCode(id);
			if (code === null) return undefined;
			for (const asset of s.entryForFile(id)?.result.assets ?? []) {
				this.addWatchFile(asset.file);
			}
			return {code, map: null, moduleType: 'js'};
		},

		configureServer(server) {
			search = createDevSearch(() => site?.pages() ?? []);
			// The content may live outside Vite's root, which Vite does not
			// watch. Watching it is also what lets `hotUpdate` see a page being
			// added or deleted, not only edited.
			void getSite().then((s) => server.watcher.add(s.watchRoots()));
			server.httpServer?.once('close', () => void search?.close());

			// Before Vite's own middlewares, so these paths are not mistaken
			// for modules or for SvelteKit routes.
			server.middlewares.use(async (req, res, next) => {
				const url = (req.url ?? '').split('?')[0];
				try {
					if (url.startsWith('/pagefind/')) {
						const file = await search!.file(
							decodeURIComponent(url.slice('/pagefind/'.length)),
						);
						if (!file) return next();
						res.setHeader(
							'Content-Type',
							MIME[extname(url)] ?? 'application/octet-stream',
						);
						res.setHeader('Cache-Control', 'no-store');
						res.end(Buffer.from(file));
						return;
					}
					const {publicRoot, base} = config;
					if (publicRoot && url.startsWith(base)) {
						const rel = normalize(decodeURIComponent(url.slice(base.length)));
						if (rel && !rel.startsWith('..')) {
							const file = join(publicRoot, rel);
							if (existsSync(file) && statSync(file).isFile()) {
								res.setHeader(
									'Content-Type',
									MIME[extname(file)] ?? 'application/octet-stream',
								);
								createReadStream(file).pipe(res);
								return;
							}
						}
					}
				} catch (error) {
					return next(error);
				}
				next();
			});
		},

		async hotUpdate({file, timestamp}) {
			if (!site || !site.isWatched(file)) return;
			const key = `${file}@${timestamp}`;
			let pending = updates.get(key);
			if (!pending) {
				pending = site.update(file);
				updates.clear();
				updates.set(key, pending);
				search?.invalidate();
			}
			const {structural} = await pending;
			report(site.check());
			if (!structural) return;
			const graph = this.environment.moduleGraph;
			const virtual = graph.getModuleById(RESOLVED);
			if (virtual) graph.invalidateModule(virtual);
			if (this.environment.name === 'client') {
				this.environment.hot.send({type: 'full-reload'});
			}
			return [];
		},
	};
}
