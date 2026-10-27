import {describe, expect, it} from 'vitest';
import {normaliseContainers} from '../../docs-engine/markdown/prepass';

describe('normaliseContainers', () => {
	it('glues the name to the colons and turns the rest into a label', () => {
		expect(normaliseContainers('::: tip Read this\nbody\n:::').text).toBe(
			'\n:::tip[Read this]\n\nbody\n\n:::\n',
		);
	});

	it('splits the compact form into blocks', () => {
		const {text} = normaliseContainers('::: warning\nCareful.\n:::');
		expect(text.split('\n').filter(Boolean)).toEqual([
			':::warning',
			'Careful.',
			':::',
		]);
	});

	it('leaves fenced code alone', () => {
		const source = '```md\n::: tip\n:::\n```';
		expect(normaliseContainers(source).text).toBe(source);
	});

	it('passes attributes through', () => {
		expect(normaliseContainers(':::component{name=X}').text).toContain(
			':::component{name=X}',
		);
	});

	it('maps output lines back to source lines', () => {
		const {text, lines} = normaliseContainers('a\n::: tip\nb\n:::\nc');
		const out = text.split('\n');
		expect(lines[out.indexOf('b')]).toBe(3);
		expect(lines[out.indexOf('c')]).toBe(5);
	});
});
