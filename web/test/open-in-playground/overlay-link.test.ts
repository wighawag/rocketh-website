/**
 * The port of the playground's `2.` encoder
 * (`open-in-playground/overlay-link.js`) and the test copy of its decoder
 * (`decode-overlay.ts`) against the playground's shared test vectors, copied here as they are from
 * rocketh-playground's `web/test/lib/playground/`: `overlay-link-vector.json`
 * (no base) and `overlay-link-bare-vector.json` (`base: "bare"`).
 */
import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {deflateSync, strToU8} from 'fflate';
import {
	encodeOverlay,
	OVERLAY_FRAGMENT_LIMIT,
	toBase64URL,
} from '../../open-in-playground/overlay-link.js';
import {decodeOverlay, NewerLinkError, ShareLinkError} from './decode-overlay';
import {incompressible, STAND_IN_BASES} from './helpers';

type Vector = {
	files: Record<string, string>;
	select: string;
	base?: 'bare';
	value: string;
};

const readVector = (name: string) =>
	JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8')) as Vector;

const vector = readVector('./overlay-link-vector.json');
const bareVector = readVector('./overlay-link-bare-vector.json');

/** A `2.` value holding `content` as it is, written past the encoder's checks. */
const rawOverlay = (content: unknown) =>
	'2.' + toBase64URL(deflateSync(strToU8(JSON.stringify(content)), {level: 9}));

describe('the port of the `2.` link encoder', () => {
	it('reproduces the shared test vector without a base exactly', () => {
		expect(vector.value).toMatch(/^2\.[A-Za-z0-9_-]+$/);
		expect(vector.base).toBeUndefined();
		expect(encodeOverlay(vector.files, vector.select)).toBe(vector.value);
		expect(encodeOverlay(vector.files, vector.select, {})).toBe(vector.value);
	});

	it('reproduces the shared bare test vector exactly', () => {
		expect(bareVector.value).toMatch(/^2\.[A-Za-z0-9_-]+$/);
		expect(bareVector.base).toBe('bare');
		expect(bareVector.files).toEqual(vector.files);
		expect(bareVector.select).toBe(vector.select);
		expect(
			encodeOverlay(bareVector.files, bareVector.select, {base: 'bare'}),
		).toBe(bareVector.value);
	});

	it('gives the same value whatever order the files are given in', () => {
		const reversed = Object.fromEntries(Object.entries(vector.files).reverse());
		expect(Object.keys(reversed)).not.toEqual(Object.keys(vector.files));
		expect(encodeOverlay(reversed, vector.select)).toBe(vector.value);
		expect(encodeOverlay(reversed, vector.select, {base: 'bare'})).toBe(
			bareVector.value,
		);
	});

	it('refuses a base other than none or "bare"', () => {
		expect(() =>
			encodeOverlay(vector.files, vector.select, {
				base: 'full' as 'bare',
			}),
		).toThrow(`a link's base is "bare", or none, not "full"`);
	});

	it('refuses a link over the 32 KB fragment cap', () => {
		expect(OVERLAY_FRAGMENT_LIMIT).toBe(32 * 1024);
		expect(() =>
			encodeOverlay({'contracts/Big.sol': incompressible(40_000)}),
		).toThrow(/bytes of fragment, over the 32768 a link carries/);
	});
});

describe('the test copy of the `2.` link decoder', () => {
	it('opens the vector without a base over the starting project', () => {
		expect(decodeOverlay(vector.value, STAND_IN_BASES)).toEqual({
			files: {...STAND_IN_BASES.starting, ...vector.files},
			select: vector.select,
		});
	});

	it('opens the bare vector over the bare base: its files and its select', () => {
		expect(decodeOverlay(bareVector.value, STAND_IN_BASES)).toEqual({
			files: bareVector.files,
			select: bareVector.select,
		});
	});

	it('refuses an unknown base, as a link for a newer playground', () => {
		const value = rawOverlay({base: 'full', files: vector.files});
		expect(() => decodeOverlay(value, STAND_IN_BASES)).toThrow(NewerLinkError);
	});

	it('refuses a base that is not a name, as corrupted', () => {
		const value = rawOverlay({base: 1, files: vector.files});
		expect(() => decodeOverlay(value, STAND_IN_BASES)).toThrow(
			new ShareLinkError("its base is 1, which is not a base's name"),
		);
	});

	it('refuses an unknown key, as a link for a newer playground', () => {
		const value = rawOverlay({files: vector.files, theme: 'dark'});
		expect(() => decodeOverlay(value, STAND_IN_BASES)).toThrow(NewerLinkError);
	});
});
