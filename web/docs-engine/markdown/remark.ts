/**
 * The Markdown-level (mdast) transforms. Each is a plain function over the
 * tree, called in order by `render.ts`.
 */
import GithubSlugger from 'github-slugger';
import type {Heading} from '../../src/lib/core/docs/types.js';
import {coerceProp} from '../../src/lib/core/docs/props.js';
import {textOf, walk, type AnyNode} from './tree.js';

/** VitePress's container kinds, plus GitHub's alert names. */
const CALLOUTS: Record<string, string> = {
	tip: 'Tip',
	info: 'Info',
	note: 'Note',
	important: 'Important',
	warning: 'Warning',
	caution: 'Caution',
	danger: 'Danger',
	details: 'Details',
};

/** GitHub alerts (`> [!NOTE]`), so content renders the same on GitHub. */
const GITHUB_ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/;

/** The label of a directive (`:::tip[This]`), removed from its children. */
function takeLabel(node: AnyNode): string | null {
	const first = node.children?.[0];
	if (first?.type === 'paragraph' && first.data?.directiveLabel) {
		node.children!.shift();
		return textOf(first).trim() || null;
	}
	return null;
}

function callout(kind: string, title: string, children: AnyNode[]): AnyNode {
	const isDetails = kind === 'details';
	const heading: AnyNode = {
		type: 'paragraph',
		data: {
			hName: isDetails ? 'summary' : 'p',
			hProperties: {className: ['callout-title']},
		},
		children: [{type: 'text', value: title}],
	};
	return {
		type: 'callout',
		data: {
			hName: isDetails ? 'details' : 'div',
			hProperties: {
				className: ['callout', `callout-${kind}`],
				...(isDetails ? {} : {role: 'note'}),
			},
		},
		children: [heading, ...children],
	};
}

/**
 * `:::tip` / `:::warning [Title]` / `:::details` containers, GitHub alerts,
 * and `:::code-group` (marked here, turned into tabs once the code is
 * highlighted, in `rehype.ts`).
 */
export function containers(tree: AnyNode): void {
	walk(tree, (node, parent, index) => {
		if (!parent) return;
		if (node.type === 'containerDirective') {
			const kind = String(node.name).toLowerCase();
			if (kind in CALLOUTS) {
				const title = takeLabel(node) ?? CALLOUTS[kind];
				parent.children![index] = callout(kind, title, node.children ?? []);
			} else if (kind === 'code-group') {
				takeLabel(node);
				node.data = {
					hName: 'div',
					hProperties: {className: ['code-group']},
				};
				node.handled = true;
			}
			return;
		}
		if (node.type === 'blockquote') {
			const first = node.children?.[0];
			const lead = first?.type === 'paragraph' ? first.children?.[0] : null;
			if (lead?.type !== 'text') return;
			const match = lead.value!.match(GITHUB_ALERT);
			if (!match) return;
			lead.value = lead.value!.slice(match[0].length);
			if (!lead.value) first!.children!.shift();
			// `[!NOTE]` on a line of its own leaves an empty first line behind.
			const next = first!.children?.[0];
			if (next?.type === 'break') first!.children!.shift();
			if (!first!.children!.length) node.children!.shift();
			const kind = match[1].toLowerCase();
			parent.children![index] = callout(
				kind,
				CALLOUTS[kind],
				node.children ?? [],
			);
		}
	});
}

/**
 * `::component{name=Counter start=3}` becomes a placeholder the site mounts a
 * Svelte component into (see `src/lib/core/docs/embeds.ts`). The container
 * form `:::component{name=X}` keeps its Markdown body as the content shown
 * before (or without) JavaScript.
 */
export function embeds(tree: AnyNode, warn: (message: string) => void): void {
	walk(tree, (node) => {
		if (
			(node.type === 'leafDirective' || node.type === 'containerDirective') &&
			node.name === 'component'
		) {
			const {name, ...rest} = (node.attributes ?? {}) as Record<string, string>;
			if (!name) {
				warn(`::component without a name (line ${node.position?.start.line})`);
				return;
			}
			const props = Object.fromEntries(
				Object.entries(rest).map(([k, v]) => [k, coerceProp(v ?? '')]),
			);
			if (node.type === 'leafDirective') node.children = [];
			else takeLabel(node);
			node.data = {
				hName: 'div',
				hProperties: {
					className: ['embed'],
					dataEmbed: name,
					dataProps: JSON.stringify(props),
				},
			};
			node.handled = true;
		}
	});
}

/**
 * remark-directive also reads `:name` in running text as a directive, so
 * `ratio 16:9` or `see note:here` would silently lose words. Any directive no
 * transform claimed goes back to being the exact source text it came from.
 */
export function restoreUnclaimedDirectives(
	tree: AnyNode,
	source: string,
): void {
	walk(tree, (node, parent, index) => {
		if (!parent || !node.type.endsWith('Directive') || node.handled) return;
		const start = node.position?.start.offset;
		const end = node.position?.end.offset;
		const raw =
			start !== undefined && end !== undefined
				? source.slice(start, end)
				: `:${node.name}`;
		if (node.type === 'textDirective') {
			parent.children![index] = {type: 'text', value: raw};
			return 'skip';
		}
		// An unknown block directive: keep its body, and show the fences as
		// text so the author sees what was not understood.
		const open = raw.split('\n')[0];
		parent.children![index] = {
			type: 'blockquote',
			data: {hName: 'div', hProperties: {className: ['unknown-directive']}},
			children: [
				{type: 'paragraph', children: [{type: 'text', value: open}]},
				...(node.type === 'containerDirective' ? (node.children ?? []) : []),
			],
		};
	});
}

/** `## Title {#custom-id}`, VitePress's explicit anchor syntax. */
const CUSTOM_ID = /\s*\{#([^}\s]+)\}\s*$/;

export type HeadingsResult = {
	title: string | null;
	hasH1: boolean;
	headings: Heading[];
};

/**
 * Give every heading an id (the `{#id}` suffix when there is one, else a
 * GitHub-style slug, so `#anchors` match the ones GitHub renders for the same
 * file), and collect the h2/h3 for the table of contents.
 */
export function headings(tree: AnyNode): HeadingsResult {
	const slugger = new GithubSlugger();
	const result: HeadingsResult = {title: null, hasH1: false, headings: []};
	// Reserve explicit ids first, so a generated slug never collides with one.
	walk(tree, (node) => {
		if (node.type !== 'heading') return;
		const last = node.children?.at(-1);
		if (last?.type !== 'text') return;
		const match = last.value!.match(CUSTOM_ID);
		if (!match) return;
		last.value = last.value!.slice(0, match.index);
		node.customId = match[1];
		slugger.slug(match[1]);
	});
	walk(tree, (node) => {
		if (node.type !== 'heading') return;
		const text = textOf(node).trim();
		const id: string = node.customId ?? slugger.slug(text);
		node.data = {
			...node.data,
			hProperties: {...node.data?.hProperties, id},
		};
		if (node.depth === 1) {
			result.hasH1 = true;
			result.title ??= text;
		}
		if (node.depth === 2 || node.depth === 3) {
			result.headings.push({depth: node.depth, id, text});
		}
	});
	return result;
}

/** The first paragraph's text, for a page without a `description`. */
export function firstParagraph(tree: AnyNode, max = 280): string {
	for (const node of tree.children ?? []) {
		if (node.type !== 'paragraph') continue;
		const value = textOf(node).replace(/\s+/g, ' ').trim();
		if (!value) continue;
		if (value.length <= max) return value;
		const cut = value.slice(0, max);
		return `${cut.slice(0, cut.lastIndexOf(' ') || max).trimEnd()}…`;
	}
	return '';
}
