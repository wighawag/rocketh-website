import {describe, expect, it} from 'vitest';
import {forwardingTarget} from '../../../../src/lib/core/docs/redirect';

describe('forwardingTarget', () => {
	const anchors = {'deploying-proxies': '../proxies/', 'é t': '../e/#x'};

	it('keeps the reader anchor when the target names none', () => {
		expect(forwardingTarget('../new/', '#setup', anchors)).toBe(
			'../new/#setup',
		);
		expect(forwardingTarget('../new/', '', anchors)).toBe('../new/');
	});

	it('drops the reader anchor when the target names its own', () => {
		expect(forwardingTarget('../new/#top', '#setup', anchors)).toBe(
			'../new/#top',
		);
	});

	it('sends an anchor that moved on its own where it moved to', () => {
		expect(forwardingTarget('../new/', '#deploying-proxies', anchors)).toBe(
			'../proxies/',
		);
		expect(forwardingTarget('../new/', '#%C3%A9%20t', anchors)).toBe('../e/#x');
	});

	it('ignores an anchor that is not valid percent-encoding', () => {
		expect(forwardingTarget('../new/', '#%E0%A4%A', anchors)).toBe(
			'../new/#%E0%A4%A',
		);
	});
});
