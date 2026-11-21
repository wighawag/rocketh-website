/**
 * The playground's `2.` link encoding: some files over a base project, and
 * the file to select. This is what an "Open in playground" link carries, with
 * `base: 'bare'`, so the link opens the example without the playground's
 * Counter sample (`contracts/Counter.sol` and `deploy/01_deploy_counter.ts`).
 *
 * A hand port of rocketh-playground's
 * `web/src/lib/playground/project/overlay-link.ts`
 * (github.com/wighawag/rocketh-playground), with its types as JSDoc so that
 * Node loads it from `docs.config.js` as it is. It is held to that
 * repository's shared test vectors, copied to `test/open-in-playground/`:
 * `overlay-link-vector.json` (no base) and `overlay-link-bare-vector.json`
 * (`base: "bare"`). A change to the encoding there changes the vectors, and
 * this port and the vectors here with it.
 *
 * `encodeOverlay(files, select, {base})` is the value of the fragment's
 * `project` key: `2.` then the JSON
 * `{"base": "bare", "files": {<path>: <text>}, "select": <path>}`, deflated
 * with fflate at level 9, in base64url without padding. `base` is written only
 * when it is `"bare"` and `select` only when there is one. Keys are written in
 * sorted order (by UTF-16 code unit, JavaScript's default `sort()`), so the
 * same input always gives the same value.
 *
 * Without `base`, the link opens over the playground's starting project; with
 * `"base": "bare"`, over the starting project without its Counter sample. What
 * "bare" holds is the playground's to define; a link only names it.
 *
 * It refuses (throws) a `base` other than `undefined` or `'bare'`, and a value
 * whose fragment (`project=` and the value) would be over 32 KB, the cap every
 * shared link of the playground has, so the site build fails on such an
 * example.
 */
import {deflateSync, strToU8} from 'fflate';

export const OVERLAY_VERSION = '2.';

/** The most fragment a link carries, `project=<value>` as written: 32 KB. */
export const OVERLAY_FRAGMENT_LIMIT = 32 * 1024;

/** @param {Uint8Array} bytes */
export function toBase64URL(bytes) {
	let binary = '';
	const CHUNK = 0x8000;
	for (let i = 0; i < bytes.length; i += CHUNK)
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	return btoa(binary)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

/**
 * JSON with every object's keys in sorted order (`JSON.stringify` would put
 * integer-like keys first).
 *
 * @param {unknown} value
 * @returns {string}
 */
function sortedJSON(value) {
	if (typeof value !== 'object' || value === null) return JSON.stringify(value);
	const object = /** @type {Record<string, unknown>} */ (value);
	const keys = Object.keys(object)
		.filter((key) => object[key] !== undefined)
		.sort();
	return `{${keys.map((key) => `${JSON.stringify(key)}:${sortedJSON(object[key])}`).join(',')}}`;
}

/** The bases a `2.` link may name; without one, it opens over the starting project. */
export const OVERLAY_BASES = /** @type {const} */ (['bare']);

/** @typedef {(typeof OVERLAY_BASES)[number]} OverlayBase */

/**
 * @typedef {object} OverlayOptions
 * @property {OverlayBase} [base] `'bare'`: open over the starting project
 *   without its Counter sample.
 */

/**
 * The `project` value opening the base (`options.base`) with `files` over it
 * and `select` selected.
 *
 * @param {Record<string, string>} files
 * @param {string} [select]
 * @param {OverlayOptions} [options]
 * @returns {string}
 */
export function encodeOverlay(files, select, options = {}) {
	const {base} = options;
	if (
		base !== undefined &&
		!(/** @type {readonly unknown[]} */ (OVERLAY_BASES).includes(base))
	) {
		throw new Error(
			`a link's base is ${OVERLAY_BASES.map((b) => JSON.stringify(b)).join(' or ')}, or none, not ${JSON.stringify(base)}`,
		);
	}
	const value =
		OVERLAY_VERSION +
		toBase64URL(
			deflateSync(strToU8(sortedJSON({base, files, select})), {level: 9}),
		);
	const length = 'project='.length + value.length;
	if (length > OVERLAY_FRAGMENT_LIMIT) {
		throw new Error(
			`this link would carry ${length} bytes of fragment, over the ${OVERLAY_FRAGMENT_LIMIT} a link carries`,
		);
	}
	return value;
}
