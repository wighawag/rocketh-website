/**
 * The playground's `2.` link encoding: some files over the playground's
 * starting project, and the file to select. This is what an "Open in
 * playground" link carries.
 *
 * A COPY of rocketh-playground's `web/src/lib/playground/project/overlay-link.ts`
 * (github.com/wighawag/rocketh-playground), with its types as JSDoc so that
 * Node loads it from `docs.config.js` as it is. It is held to that
 * repository's shared test vector, copied to
 * `test/open-in-playground/overlay-link-vector.json`: a change to the encoding
 * there changes the vector, and this copy and the vector here with it.
 *
 * `encodeOverlay(files, select)` is the value of the fragment's `project` key:
 * `2.` then the JSON `{"files": {<path>: <text>}, "select": <path>}` (`select`
 * left out when there is none), deflated with fflate at level 9, in base64url
 * without padding. Keys are written in sorted order (by UTF-16 code unit,
 * JavaScript's default `sort()`), so the same input always gives the same
 * value.
 *
 * It refuses (throws) a value whose fragment (`project=` and the value) would
 * be over 32 KB, the cap every shared link of the playground has, so the site
 * build fails on such an example.
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

/**
 * The `project` value opening the starting project with `files` over it and
 * `select` selected.
 *
 * @param {Record<string, string>} files
 * @param {string} [select]
 * @returns {string}
 */
export function encodeOverlay(files, select) {
	const value =
		OVERLAY_VERSION +
		toBase64URL(deflateSync(strToU8(sortedJSON({files, select})), {level: 9}));
	const length = 'project='.length + value.length;
	if (length > OVERLAY_FRAGMENT_LIMIT) {
		throw new Error(
			`this link would carry ${length} bytes of fragment, over the ${OVERLAY_FRAGMENT_LIMIT} a link carries`,
		);
	}
	return value;
}
