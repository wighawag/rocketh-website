/**
 * A line-level pass over the Markdown source, run before it is parsed.
 *
 * VitePress writes containers as `::: tip Optional title`, with a space after
 * the colons, and often in a COMPACT form where the opening line, the body and
 * the closing `:::` sit in one paragraph:
 *
 *     ::: warning
 *     Do not do this.
 *     :::
 *
 * remark-directive wants the name glued to the colons (`:::tip[Title]`), and a
 * block directive that is part of a paragraph is not a block at all. So this
 * rewrites every container fence outside code into remark-directive's syntax,
 * on a line of its own with blank lines around it. Nothing else is touched,
 * and lines inside fenced code are never touched.
 *
 * Line count changes (blank lines are added), so the result carries a map
 * back to the source lines for error messages.
 */

const OPEN = /^(\s*)(:{3,})\s*([A-Za-z][\w-]*)\s*(.*?)\s*$/;
const CLOSE = /^(\s*)(:{3,})\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})/;

/**
 * Turn the rest of an opening line into a directive label and attributes.
 * `{...}` passes through as attributes (`:::component{name=X}`); anything else
 * is a title (`::: tip Read this` -> `[Read this]`).
 */
function tail(rest: string): string {
	if (!rest) return '';
	if (rest.startsWith('{') || rest.startsWith('[')) return rest;
	return `[${rest.replace(/([[\]\\])/g, '\\$1')}]`;
}

export type Prepared = {
	text: string;
	/** `lines[n]` is the 1-based source line of output line `n + 1`. */
	lines: number[];
};

export function normaliseContainers(source: string): Prepared {
	const out: string[] = [];
	const lines: number[] = [];
	let fence: string | null = null;
	const input = source.split('\n');
	for (let n = 0; n < input.length; n++) {
		const line = input[n];
		const push = (...added: string[]) => {
			for (const a of added) {
				out.push(a);
				lines.push(n + 1);
			}
		};
		const f = line.match(FENCE);
		if (f) {
			const marker = f[1];
			if (fence === null) fence = marker;
			else if (
				marker[0] === fence[0] &&
				marker.length >= fence.length &&
				line.trim() === marker
			)
				fence = null;
			push(line);
			continue;
		}
		if (fence !== null) {
			push(line);
			continue;
		}
		const open = line.match(OPEN);
		if (open) {
			const [, indent, colons, name, rest] = open;
			push('', `${indent}${colons}${name}${tail(rest)}`, '');
			continue;
		}
		const close = line.match(CLOSE);
		if (close) {
			push('', `${close[1]}${close[2]}`, '');
			continue;
		}
		push(line);
	}
	return {text: out.join('\n'), lines};
}
