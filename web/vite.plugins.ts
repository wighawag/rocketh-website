import type {Plugin, PluginOption} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {docs} from './docs-engine/vite-plugin.js';
import {loadDocsConfig} from './docs-engine/config.js';

/**
 * `@rocketh/playground`, taken from the rocketh checkout the content comes
 * from (`contentDir` in docs.config.js), never from npm: the widget on a page
 * must be the one of the same rocketh commit, and an npm release lags main.
 *
 * The two entries the site reaches are aliased to the package's `dist`, which
 * rocketh builds with `pnpm docs:widgets`. Everything they import in turn
 * (rocketh, viem, the in-browser EVM) is resolved from that package's own
 * `node_modules`, that is from the rocketh workspace, so the rocketh checkout
 * must be installed and built first. A missing build fails here, by name,
 * rather than as an unresolved import deep in the bundle.
 */
function rockethPlayground(): Plugin {
	let element = '';
	return {
		name: 'rocketh-playground',
		enforce: 'pre',
		async config() {
			const {contentRoot} = await loadDocsConfig();
			const pkg = join(contentRoot, 'packages', 'rocketh-playground');
			element = join(pkg, 'dist', 'element', 'rocketh-playground.js');
			return {
				resolve: {
					alias: [
						{find: /^@rocketh\/playground\/element$/, replacement: element},
						{
							find: /^@rocketh\/playground$/,
							replacement: join(pkg, 'dist', 'index.js'),
						},
					],
				},
			};
		},
		buildStart() {
			if (!existsSync(element)) {
				this.error(
					`rocketh-playground: ${element} does not exist. Build it in the rocketh checkout first: \`pnpm i && pnpm docs:widgets\`.`,
				);
			}
		},
	};
}

/**
 * The rocketh agent skills, served raw at `/skills/<name>/SKILL.md` and
 * `/skills/<name>/references/<file>.md`, from the `skills/` folder of the
 * rocketh checkout the content comes from. An agent reads these files as they
 * are, so they are copied byte for byte, never rendered as pages (they are not
 * in `include` in docs.config.js).
 *
 * In a build they are emitted as assets of the client build, which
 * adapter-static copies into `build/` unchanged; GitHub Pages then serves a
 * `.md` file as `text/markdown; charset=utf-8`. The dev server serves them
 * with that type too. A rocketh checkout without `skills/` serves nothing.
 */
export function skillFiles(skillsRoot: string): string[] {
	if (!existsSync(skillsRoot)) return [];
	const files: string[] = [];
	for (const skill of readdirSync(skillsRoot, {withFileTypes: true})) {
		if (!skill.isDirectory()) continue;
		const dir = join(skillsRoot, skill.name);
		if (existsSync(join(dir, 'SKILL.md'))) files.push(`${skill.name}/SKILL.md`);
		const references = join(dir, 'references');
		if (!existsSync(references)) continue;
		for (const file of readdirSync(references).sort()) {
			if (file.endsWith('.md')) files.push(`${skill.name}/references/${file}`);
		}
	}
	return files.sort();
}

function rockethSkills(): Plugin {
	let skillsRoot = '';
	return {
		name: 'rocketh-skills',
		async configResolved() {
			const {contentRoot} = await loadDocsConfig();
			skillsRoot = join(contentRoot, 'skills');
		},
		generateBundle() {
			if (this.environment.config.consumer !== 'client') return;
			for (const file of skillFiles(skillsRoot)) {
				this.emitFile({
					type: 'asset',
					fileName: `skills/${file}`,
					source: readFileSync(join(skillsRoot, file)),
				});
			}
		},
		configureServer(server) {
			server.middlewares.use('/skills/', (req, res, next) => {
				const file = decodeURIComponent((req.url ?? '').split('?')[0]).replace(
					/^\/+/,
					'',
				);
				if (!skillFiles(skillsRoot).includes(file)) return next();
				res.setHeader('content-type', 'text/markdown; charset=utf-8');
				res.end(readFileSync(join(skillsRoot, file)));
			});
		},
	};
}

/**
 * The vite plugins THIS project adds to the template's.
 *
 * This variant adds Tailwind (from `template-svelte-tailwind`) and the docs
 * engine (`docs()`, see `docs-engine/vite-plugin.ts`). Tailwind used to be an
 * import and a line in `vite.config.ts`, which made that file differ from
 * the stem's forever to say one thing; now `vite.config.ts` here is BYTE
 * IDENTICAL to `template-svelte`'s and this is the only file that differs.
 *
 * That is the seam paying for itself immediately: the merge that introduced it
 * conflicted in exactly the slot this replaces, which is the last time that
 * file has to conflict for this reason.
 *
 * WHY THAT IS WORTH A FILE. `vite.config.ts` is a template file: it travels
 * into every project scaffolded from this one and is merged down into every
 * repo that tracks it, and it keeps developing here for reasons that have
 * nothing to do with any one descendant. So every descendant that edits it buys
 * a conflict in every future merge, forever - and the whole tree already does.
 * Measured when this was written: `template-svelte-tailwind`'s ONLY change to
 * `vite.config.ts` was one import and one line in `plugins`; the shadcn variant
 * inherited exactly that; jolly-roger carries the same line; and further down,
 * a repo with an art build had restructured the file wholesale to get ~300
 * lines of sprite pipeline out of the middle of it.
 *
 * They were all paying a merge tax to say one thing, and it is the same one
 * thing every time: "and also this plugin".
 *
 * This is the shape the tree already uses where it has learned this lesson: a
 * SMALL FILE WHOSE JOB IS TO DIFFER, so that the large shared file does not
 * have to. `core/connection/mode.ts` is the other instance, where one constant
 * is the whole difference between three branches.
 *
 * ## The contract
 *
 * **Position.** These are spread in immediately before `sveltekit()`, and after
 * `devtoolsJson()`. That is not arbitrary and it is not free to change: it is
 * where every repo in this tree already put its extra plugin, and Tailwind in
 * particular documents that `tailwindcss()` must come before `sveltekit()`. If
 * you need a plugin AFTER sveltekit, say so here rather than reaching into
 * `vite.config.ts`, and change the spread's position for everyone.
 *
 * **A FUNCTION, not a constant array**, and this one is load-bearing rather
 * than stylistic. `vite.config.ts` is also the vitest config, and it declares
 * `projects` that `extends` it - so the config is evaluated several times in
 * one process. A module-level array would hand every one of those the SAME
 * plugin objects, and vite plugins hold per-build state (a watcher, a resolved
 * command, a cache). Sharing them across builds is the kind of bug that shows
 * up as one project's watcher firing into another's build. Returning a fresh
 * array per call costs nothing and removes the question.
 *
 * **Falsy entries are fine.** Vite filters them out of `plugins`, so a plugin
 * that decides it has nothing to do can `return false` from its own factory
 * and the caller stays a single unconditional line. That is what keeps this
 * file free of `if` statements about art folders, environment variables and
 * whether this is a test run - those belong to the plugin that cares.
 */
export function extraPlugins(): PluginOption[] {
	// `docs()` is `enforce: 'pre'`, so its place in this list does not matter
	// to Vite. Both come before `sveltekit()`, which is what the spread's position in
	// `vite.config.ts` guarantees and what Tailwind's own SvelteKit
	// instructions require. If that ever needs to change, it changes there,
	// for everyone, rather than here.
	return [docs(), rockethPlayground(), rockethSkills(), tailwindcss()];
}
