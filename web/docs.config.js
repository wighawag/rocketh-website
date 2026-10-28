// What the rocketh.dev site renders, and where it finds it. Every field is
// optional; docs-engine/config.js has the full list, the defaults and what
// each means.
//
// The CONTENT is not in this repository: it is the Markdown of the rocketh
// repository (github.com/wighawag/rocketh), so a page is edited, reviewed and
// versioned with the code it documents. This repository is only the site.
//
// Where the rocketh checkout is:
//
//   - by default a sibling of this repository, `../rocketh` (that is
//     `../../rocketh` from this file), which is how both are laid out locally
//     and in rocketh's deploy workflow;
//   - anywhere else with `ROCKETH_DIR`, resolved against the current
//     directory: `ROCKETH_DIR=~/dev/worktrees/rocketh/my-branch pnpm build`.
//
// The playground widget is built from the same checkout (see vite.plugins.ts).

import {resolve} from 'node:path';

const rockethDir = process.env.ROCKETH_DIR
	? resolve(process.cwd(), process.env.ROCKETH_DIR)
	: '../../rocketh';

/** @type {import('./docs-engine/config.js').DocsConfig} */
export default {
	contentDir: rockethDir,

	// The rocketh repository root holds a lot of other Markdown (READMEs of
	// every package, work items, ADRs): only these are pages.
	include: ['index.md', 'documentation/**/*.md', 'hardhat-deploy/**/*.md'],

	base: '/',

	// Logos and social cards: `public/logo.svg` is `/logo.svg`.
	publicDir: 'public',

	sections: [
		{dir: 'documentation', label: 'Documentation'},
		{dir: 'hardhat-deploy', label: 'hardhat-deploy'},
		{dir: 'articles', label: 'Articles'},
	],

	// The articles are THIS repository's, not rocketh's: a page of the docs
	// describes the code and changes with it, an article is a dated piece
	// about the project and belongs to the site. They are mounted at
	// `/articles/` next to the content, so an article links to a page as
	// `/documentation/...` and the build checks that link like any other.
	articles: {
		dir: 'articles',
		contentDir: '../articles',
		editLink: {
			repo: 'https://github.com/wighawag/rocketh-website',
			branch: 'main',
			dir: 'articles',
		},
	},

	// Old addresses that must keep working. A page of the content that moves
	// is forwarded by rocketh's own `_redirects.yaml` (`redirectsFile`, the
	// template's default name), so the page and its redirect change in the
	// same rocketh commit. This table holds the one address that was never a
	// page of the content.
	redirects: {
		// The VitePress site rewrote the repository README to `/introduction/`.
		// It was linked from nowhere on the site, and the README is written for
		// GitHub and npm (its links point into the repository), so the address
		// forwards to the README where it reads as intended.
		'/introduction/': 'https://github.com/wighawag/rocketh#readme',
	},

	// The header's GitHub link, where the VitePress site had it.
	socialLinks: [
		{icon: 'github', link: 'https://github.com/wighawag/rocketh/#readme'},
	],

	editLink: {
		repo: 'https://github.com/wighawag/rocketh',
		branch: 'main',
		dir: '',
	},
};
