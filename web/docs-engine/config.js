// The docs site's configuration: types, defaults, and how the file is found.
//
// Plain JavaScript with JSDoc types, on purpose: it is read by THREE kinds of
// caller (`vite.config.ts` through the Vite plugin, `svelte.config.js` for the
// prerender error handler, and `scripts/docs-postbuild.js` after the build),
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
 * @property {string | null} [articles] The top-level folder holding dated
 *   articles (release notes, tutorials). It gets a list page and a feed.
 * @property {EditLinkConfig | null} [editLink]
 * @property {{light: string, dark: string}} [codeThemes] Shiki themes.
 * @property {string} [navFile] Name of the per-section file that replaces the
 *   generated sidebar. Defaults to `_sidebar.yaml`.
 */

/**
 * @typedef {Required<Omit<DocsConfig, 'editLink' | 'publicDir' | 'articles'>> & {
 *   editLink: EditLinkConfig | null,
 *   publicDir: string | null,
 *   articles: string | null,
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
	return {
		...merged,
		base: normaliseBase(merged.base),
		configFile,
		contentRoot,
		publicRoot: publicRoot && existsSync(publicRoot) ? publicRoot : null,
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
