// The docs site's configuration: types, defaults, and how the file is found.
//
// Plain JavaScript with JSDoc types, on purpose: it is read by THREE kinds of
// caller (`vite.config.ts` through the Vite plugin, `svelte.config.js` for the
// prerender error handler, and `docs-engine/postbuild.js` after the build),
// and only the first of those can import TypeScript.

import {existsSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

/**
 * @typedef {object} SectionConfig
 * @property {string} dir Top-level folder of the content directory.
 * @property {string} [label] Shown in the header nav and above the sidebar.
 *   Defaults to the `title` of the section's index page, else the folder name.
 */

/**
 * @typedef {object} EditLinkConfig
 * @property {string} repo Repository URL, e.g. `https://github.com/owner/repo`.
 * @property {string} [branch] Defaults to `main`.
 * @property {string} [dir] Path of the content directory inside that
 *   repository, e.g. `docs`. Empty when the content is the repository root.
 * @property {string} [text] Link text. Defaults to `Edit this page on GitHub`.
 */

/**
 * @typedef {object} SocialLinkConfig
 * @property {string} link Where it goes, an absolute URL.
 * @property {string} [icon] A known icon: `github`. Without one (or with an
 *   unknown one), the header shows `label` as text.
 * @property {string} [label] Accessible name, and the text shown when there
 *   is no icon. Defaults to the icon's name.
 */

/**
 * @typedef {object} ArticlesConfig
 * @property {string} dir Where the articles are in the site: `articles` lists
 *   them at `<base>articles/` and puts `hello.md` at `<base>articles/hello/`.
 *   Without `contentDir`, it is also the top-level folder of the content
 *   directory that holds them, which is what the string form means.
 * @property {string} [contentDir] A folder of their own, relative to the
 *   config file, for articles that do not live with the docs (the docs come
 *   from another repository, say). Its files are mounted at `dir`, as if they
 *   were the content directory's `<dir>/` folder, so links between the two
 *   work in both directions, relative ones included. The content directory's
 *   own `<dir>/` folder is then left out.
 * @property {string[]} [include] Globs of the articles, relative to
 *   `contentDir`. Defaults to every `.md` file. Only used with `contentDir`.
 * @property {EditLinkConfig | null} [editLink] The "edit this page" link of
 *   the articles, `dir` being the path of `contentDir` inside `repo`. Only
 *   used with `contentDir`, and none by default: the site's `editLink` points
 *   at the docs' repository, which does not hold these files.
 */

/**
 * @typedef {object} ResolvedArticles
 * @property {string} dir
 * @property {string | null} root Absolute path of the articles' own folder,
 *   null when they are a folder of the content directory.
 * @property {string[]} include
 * @property {EditLinkConfig | null} editLink
 */

/**
 * @typedef {object} DocsConfig
 * @property {string} [contentDir] The Markdown folder, relative to the config
 *   file. It may live anywhere: `../docs`, a sibling package, the root of
 *   another repository.
 * @property {string[]} [include] Globs, relative to `contentDir`, of the
 *   Markdown files that are pages. Defaults to every `.md` file.
 * @property {string[]} [exclude] Globs to leave out, on top of
 *   `node_modules`, dot folders and `publicDir`.
 * @property {string} [base] Where the content is mounted in the site, `/` by
 *   default. `/docs/` puts `guide/intro.md` at `/docs/guide/intro/`.
 * @property {string | null} [publicDir] A folder of the content directory
 *   served as-is at the mount point (images, logos), like VitePress's `public`.
 * @property {SectionConfig[]} [sections] The top-level sections, in order.
 *   Defaults to every top-level folder that has pages.
 * @property {string | ArticlesConfig | null} [articles] Dated articles
 *   (release notes, announcements, tutorials), with a list page and a feed.
 *   A string names a top-level folder of `contentDir`; an object can take
 *   them from a folder of their own (see `ArticlesConfig`).
 * @property {EditLinkConfig | null} [editLink]
 * @property {{light: string, dark: string}} [codeThemes] Shiki themes.
 * @property {string} [navFile] Name of the per-section file that replaces the
 *   generated sidebar. Defaults to `_sidebar.yaml`.
 * @property {SocialLinkConfig[]} [socialLinks] Links at the right of the
 *   header, VitePress style: `[{icon: 'github', link: 'https://github.com/o/r'}]`.
 * @property {Record<string, string>} [redirects] Old addresses that must keep
 *   working: `{'/old/path/': '/new/path/'}`. Each key is a SITE path (from the
 *   site root, whatever `base` is) and gets a forwarding page in the build.
 *   Each value is a site path of a page (an `#anchor` may follow), or an
 *   absolute `https://` URL. A key that is also a page, or a value that is
 *   not one, fails the build like a dead link. A key may also name one anchor
 *   of an old address (`'/old/path/#section': '/elsewhere/'`), forwarded on
 *   its own when the reader arrives with it; the address itself must then be
 *   a key too.
 * @property {string | null} [redirectsFile] A YAML file of the content
 *   directory holding more redirects, in the same shape as `redirects`, so
 *   that moving a page and forwarding its old address can happen in one change
 *   to the content. Defaults to `_redirects.yaml`; read when it exists. A key
 *   listed both there and in `redirects` fails the build.
 */

/**
 * @typedef {Required<Omit<DocsConfig, 'editLink' | 'publicDir' | 'articles'>> & {
 *   editLink: EditLinkConfig | null,
 *   publicDir: string | null,
 *   articles: string | null,
 *   articlesSource: ResolvedArticles | null,
 *   configFile: string,
 *   contentRoot: string,
 *   publicRoot: string | null,
 * }} ResolvedDocsConfig
 */

/** Defaults for every field a config file may leave out. */
export const DEFAULTS = Object.freeze({
	contentDir: '../docs',
	include: ['**/*.md'],
	exclude: [],
	base: '/',
	publicDir: 'public',
	sections: [],
	articles: null,
	editLink: null,
	codeThemes: {light: 'github-light', dark: 'github-dark'},
	navFile: '_sidebar.yaml',
	redirects: {},
	redirectsFile: '_redirects.yaml',
	socialLinks: [],
});

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Which config file to read: `$DOCS_CONFIG` when set (relative to the current
 * directory), else `web/docs.config.js`. The environment variable is how a
 * one-off build points at other content without editing a tracked file.
 */
export function configFilePath() {
	const fromEnv = process.env.DOCS_CONFIG;
	if (fromEnv) return resolve(process.cwd(), fromEnv);
	return resolve(here, '..', 'docs.config.js');
}

/**
 * Ensure `/x/` shape: leading and trailing slash, `/` for the root.
 *
 * @param {string} base
 */
export function normaliseBase(base) {
	let out = base.trim() || '/';
	if (!out.startsWith('/')) out = `/${out}`;
	if (!out.endsWith('/')) out = `${out}/`;
	return out;
}

/**
 * Fill defaults and resolve paths against the config file's folder.
 *
 * @param {DocsConfig} raw
 * @param {string} configFile
 * @returns {ResolvedDocsConfig}
 */
export function resolveConfig(raw, configFile) {
	const merged = {...DEFAULTS, ...raw};
	const from = dirname(configFile);
	const contentRoot = isAbsolute(merged.contentDir)
		? merged.contentDir
		: resolve(from, merged.contentDir);
	const publicRoot = merged.publicDir
		? resolve(contentRoot, merged.publicDir)
		: null;
	const articlesSource = resolveArticles(merged.articles, from);
	return {
		...merged,
		// The folder name, as the string form gives it: what the rest of the
		// engine (and any code reading the config) keys articles by.
		articles: articlesSource?.dir ?? null,
		articlesSource,
		base: normaliseBase(merged.base),
		configFile,
		contentRoot,
		publicRoot: publicRoot && existsSync(publicRoot) ? publicRoot : null,
	};
}

/**
 * The `articles` field in one shape, whichever form it was given in.
 *
 * @param {string | ArticlesConfig | null | undefined} articles
 * @param {string} from The config file's folder.
 * @returns {ResolvedArticles | null}
 */
export function resolveArticles(articles, from) {
	if (!articles) return null;
	const options = typeof articles === 'string' ? {dir: articles} : articles;
	const dir =
		typeof options.dir === 'string'
			? options.dir.trim().replace(/^\/+|\/+$/g, '')
			: '';
	if (!dir || dir.includes('/')) {
		throw new Error(
			`docs: \`articles\` needs a \`dir\`, one folder name such as 'articles' (got ${JSON.stringify(options.dir)})`,
		);
	}
	if (!options.contentDir) {
		return {dir, root: null, include: [], editLink: null};
	}
	return {
		dir,
		root: isAbsolute(options.contentDir)
			? options.contentDir
			: resolve(from, options.contentDir),
		include: options.include ?? ['**/*.md'],
		editLink: options.editLink ?? null,
	};
}

/**
 * Read and resolve the config file. A fresh import each call (cache-busted),
 * so a dev server restart picks up an edited file.
 *
 * @param {string} [file]
 * @returns {Promise<ResolvedDocsConfig>}
 */
export async function loadDocsConfig(file = configFilePath()) {
	const url = pathToFileURL(file);
	url.searchParams.set('t', String(Date.now()));
	const mod = await import(url.href);
	return resolveConfig(mod.default ?? {}, file);
}
