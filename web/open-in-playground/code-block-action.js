/**
 * The "Open in playground" link on a sample that stands for a file of a
 * playground example (the docs engine's `codeBlockAction`, set in
 * `docs.config.js`).
 *
 * A sample is marked in its fence's info string, after the language:
 *
 *     ```typescript playground=greetings-registry/deploy/001_deploy_greetings_registry.ts
 *
 * which names the example `examples/playground/greetings-registry/` of the
 * rocketh checkout and the file `deploy/001_deploy_greetings_registry.ts` in
 * it (rocketh's `examples/playground/README.md` says what an example holds,
 * and rocketh's own tests check that the sample equals the file). At build
 * time every file of the example is read and encoded, with the named file to
 * select, in the playground's `2.` encoding (`overlay-link.js`) with
 * `base: 'bare'`, so the link opens the example's files over the playground's
 * starting project without its Counter sample (`contracts/Counter.sol` and
 * `deploy/01_deploy_counter.ts`): the reader sees the example, not the
 * example beside a Counter it does not use.
 *
 * A marker naming an example or a file that does not exist, or an example
 * whose link would be over the playground's 32 KB cap, throws: the engine
 * then fails the build naming the page and the fence's line. A fence without
 * the marker is left as it is.
 */
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {encodeOverlay} from './overlay-link.js';

/** Where the examples live, relative to the rocketh checkout. */
export const EXAMPLES_DIR = 'examples/playground';

/** The info-string word that marks a sample. */
const MARKER = 'playground=';

/** The playground a link opens. */
export const PLAYGROUND_URL = 'https://play.rocketh.dev/';

export const LINK_LABEL = 'Open in playground';

/**
 * Every file under `dir`, by its `/`-separated path relative to `dir`.
 *
 * @param {string} dir
 * @returns {Record<string, string>}
 */
export function readExample(dir) {
	/** @type {Record<string, string>} */
	const files = {};
	/** @param {string} path */
	const walk = (path) => {
		const full = path ? join(dir, path) : dir;
		if (statSync(full).isDirectory()) {
			for (const entry of readdirSync(full).sort()) {
				walk(path ? `${path}/${entry}` : entry);
			}
		} else {
			files[path] = readFileSync(full, 'utf-8');
		}
	};
	walk('');
	return files;
}

/**
 * The code block action for the examples of the rocketh checkout at
 * `rockethDir`.
 *
 * @param {string} rockethDir
 * @returns {import('../docs-engine/config.js').CodeBlockActionHook}
 */
export function openInPlayground(rockethDir) {
	return ({meta}) => {
		const word = (meta ?? '')
			.trim()
			.split(/\s+/)
			.find((w) => w.startsWith(MARKER));
		if (!word) return undefined;
		const target = word.slice(MARKER.length);
		const [example, ...rest] = target.split('/');
		const path = rest.join('/');
		if (
			rest.length === 0 ||
			[example, ...rest].some(
				(part) =>
					part === '' || part === '.' || part === '..' || part.includes('\\'),
			)
		) {
			throw new Error(
				`${word}: a marker must be ${MARKER}<example>/<path>, a file inside ${EXAMPLES_DIR}/<example>/`,
			);
		}
		const dir = join(rockethDir, EXAMPLES_DIR, example);
		if (!existsSync(dir) || !statSync(dir).isDirectory()) {
			throw new Error(
				`${word}: there is no example ${EXAMPLES_DIR}/${example}/ in the rocketh checkout`,
			);
		}
		const files = readExample(dir);
		if (!Object.hasOwn(files, path)) {
			throw new Error(
				`${word}: the example ${EXAMPLES_DIR}/${example}/ has no file ${path}`,
			);
		}
		let value;
		try {
			value = encodeOverlay(files, path, {base: 'bare'});
		} catch (error) {
			throw new Error(
				`${word}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		return {label: LINK_LABEL, href: `${PLAYGROUND_URL}#project=${value}`};
	};
}
