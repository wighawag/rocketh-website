#!/usr/bin/env node
// Runs after `vite build` (see the `build` script in package.json):
//
//   1. copies the content's public folder (`publicDir` in docs.config.js) into
//      the build, at the mount point, where its pages link to it;
//   2. indexes the built HTML with Pagefind, into `build/pagefind/`.
//
// Kept out of the Vite build on purpose: both steps need the FINAL output,
// which only exists once SvelteKit's adapter has finished writing it.

import {cpSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as pagefind from 'pagefind';
import {loadDocsConfig} from './config.js';

const web = fileURLToPath(new URL('..', import.meta.url));
const buildDir = join(web, 'build');

if (!existsSync(buildDir)) {
	console.error('docs-postbuild: no build/ folder; run `vite build` first');
	process.exit(1);
}

const config = await loadDocsConfig();

if (config.publicRoot) {
	const target = join(buildDir, config.base);
	cpSync(config.publicRoot, target, {
		recursive: true,
		// The site's own files win: a content file must not replace, say, the
		// service worker or a prerendered page.
		force: false,
		errorOnExist: false,
	});
	console.log(`docs-postbuild: copied ${config.publicRoot} -> ${target}`);
}

const {index, errors} = await pagefind.createIndex({});
if (!index) {
	console.error(`docs-postbuild: pagefind failed: ${errors.join(', ')}`);
	process.exit(1);
}
const added = await index.addDirectory({path: buildDir});
if (added.errors.length) {
	console.error(`docs-postbuild: pagefind: ${added.errors.join(', ')}`);
	process.exit(1);
}
const written = await index.writeFiles({
	outputPath: join(buildDir, 'pagefind'),
});
if (written.errors.length) {
	console.error(`docs-postbuild: pagefind: ${written.errors.join(', ')}`);
	process.exit(1);
}
await pagefind.close();
console.log(
	`docs-postbuild: indexed ${added.page_count} page(s) into build/pagefind`,
);
