/**
 * The copy of the playground's `2.` encoder (`open-in-playground/overlay-link.js`)
 * against the playground's shared test vector, copied here as it is from
 * rocketh-playground's `web/test/lib/playground/overlay-link-vector.json`.
 */
import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {
	encodeOverlay,
	OVERLAY_FRAGMENT_LIMIT,
} from '../../open-in-playground/overlay-link.js';
import {decodeOverlay} from './decode-overlay';
import {incompressible} from './helpers';

const vector = JSON.parse(
	readFileSync(new URL('./overlay-link-vector.json', import.meta.url), 'utf8'),
) as {files: Record<string, string>; select: string; value: string};

describe('the copy of the `2.` link encoder', () => {
	it('reproduces the shared test vector exactly', () => {
		expect(vector.value).toMatch(/^2\.[A-Za-z0-9_-]+$/);
		expect(encodeOverlay(vector.files, vector.select)).toBe(vector.value);
	});

	it('gives the same value whatever order the files are given in', () => {
		const reversed = Object.fromEntries(Object.entries(vector.files).reverse());
		expect(Object.keys(reversed)).not.toEqual(Object.keys(vector.files));
		expect(encodeOverlay(reversed, vector.select)).toBe(vector.value);
	});

	it('decodes, as the playground reads it, to its files and its select', () => {
		expect(decodeOverlay(vector.value, {})).toEqual({
			files: vector.files,
			select: vector.select,
		});
	});

	it('refuses a link over the 32 KB fragment cap', () => {
		expect(OVERLAY_FRAGMENT_LIMIT).toBe(32 * 1024);
		expect(() =>
			encodeOverlay({'contracts/Big.sol': incompressible(40_000)}),
		).toThrow(/bytes of fragment, over the 32768 a link carries/);
	});
});
