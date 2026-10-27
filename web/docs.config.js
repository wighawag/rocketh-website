// What the docs site renders, and where it finds it. Every field is optional;
// docs-engine/config.js has the full list, the defaults and what each means.
//
// Point the site at other content for one build without editing this file:
//
//   DOCS_CONFIG=/path/to/other.config.js pnpm build

/** @type {import('./docs-engine/config.js').DocsConfig} */
export default {
	// The Markdown folder, relative to this file. Anywhere on disk works: a
	// sibling package (`../../docs`), or the root of another repository.
	contentDir: '../docs',

	// Which files are pages. Narrow it when the folder holds other Markdown
	// (a repository root with a README, CONTRIBUTING and so on).
	include: ['**/*.md'],

	// Where the content is mounted in the site.
	base: '/',

	// Served as-is at the mount point: `docs/public/logo.svg` is `/logo.svg`.
	publicDir: 'public',

	// The header nav, in this order. Each section gets its own sidebar.
	sections: [
		{dir: 'guide', label: 'Guide'},
		{dir: 'reference', label: 'Reference'},
		{dir: 'articles', label: 'Articles'},
	],

	// Dated pages with a list and a feed (`/feed.xml`).
	articles: 'articles',

	// Old addresses that must keep working, each forwarded to where its page
	// lives now. A key is a site path; a value is a site path or an https URL.
	// A forwarding page is written for each, and a target that is not a page
	// fails the build.
	redirects: {
		'/guide/start/': '/guide/getting-started/',
	},

	// "Edit this page on GitHub".
	editLink: {
		repo: 'https://github.com/wighawag/template-svelte-docs',
		branch: 'main',
		dir: 'docs',
	},
};
