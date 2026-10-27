/**
 * One Markdown file in, HTML and metadata out.
 *
 *   front matter (YAML) -> container pre-pass -> remark-parse + remark-gfm +
 *   remark-directive -> our mdast transforms -> remark-rehype -> rehype-raw ->
 *   Shiki + our hast transforms -> rehype-stringify
 *
 * Prose is never compiled as Svelte: the result is an HTML string the page
 * renders with `{@html}`, so `{` in prose is just a character.
 */
import {parse as parseYaml} from 'yaml';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import type {Heading} from '../../src/lib/core/docs/types.js';
import type {CodeThemes} from './highlight.js';
import {normaliseContainers} from './prepass.js';
import {
	containers,
	embeds,
	firstParagraph,
	headings,
	restoreUnclaimedDirectives,
} from './remark.js';
import {
	codeGroups,
	collectIds,
	highlightCode,
	rewriteLinks,
	type AssetImport,
	type LinkOptions,
	type LinkRecord,
} from './rehype.js';
import {isElement, textOf, walk, type AnyNode} from './tree.js';

/**
 * A fence's info string after the language (`[label]`) travels as a property:
 * rehype-raw rebuilds every element and drops anything kept in `data`.
 */
function keepCodeMeta(tree: AnyNode): void {
	walk(tree, (node) => {
		if (node.type !== 'code' || !node.meta) return;
		node.data = {
			...node.data,
			hProperties: {...node.data?.hProperties, dataMeta: node.meta},
		};
	});
}

/**
 * The line breaks remark-rehype leaves between table rows are not allowed
 * there in HTML, and rehype-raw's parser hoists them out in front of the
 * table. Drop them first.
 */
function dropTableWhitespace(tree: AnyNode): void {
	const tableParts = ['table', 'thead', 'tbody', 'tfoot', 'tr'];
	walk(tree, (node) => {
		if (!tableParts.some((t) => isElement(node, t))) return;
		node.children = (node.children ?? []).filter(
			(c) => !(c.type === 'text' && !c.value?.trim()),
		);
	});
}

export type RenderResult = {
	html: string;
	frontmatter: Record<string, unknown>;
	/** From the first `#` heading; the caller prefers frontmatter `title`. */
	headingTitle: string | null;
	hasH1: boolean;
	headings: Heading[];
	/** First paragraph, for pages without a `description`. */
	excerpt: string;
	links: LinkRecord[];
	ids: string[];
	assets: AssetImport[];
	warnings: string[];
};

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function splitFrontmatter(source: string): {
	data: Record<string, unknown>;
	body: string;
} {
	const match = source.match(FRONTMATTER);
	if (!match) return {data: {}, body: source};
	const data = parseYaml(match[1]) ?? {};
	if (typeof data !== 'object' || Array.isArray(data)) {
		throw new Error('front matter must be a YAML mapping');
	}
	// Keep the line count, so reported line numbers match the file.
	const blank = '\n'.repeat(match[0].split('\n').length - 1);
	return {data, body: blank + source.slice(match[0].length)};
}

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);
const toHtmlTree = unified().use(remarkRehype, {allowDangerousHtml: true});
const parseRawHtml = unified().use(rehypeRaw);
const stringifier = unified().use(rehypeStringify);

export type RenderOptions = {
	themes: CodeThemes;
	links: LinkOptions;
};

export async function renderMarkdown(
	source: string,
	options: RenderOptions,
): Promise<RenderResult> {
	const warnings: string[] = [];
	const {data: frontmatter, body} = splitFrontmatter(source);
	const prepared = normaliseContainers(body);
	const sourceLine = (line: number | null) =>
		line === null ? null : (prepared.lines[line - 1] ?? line);

	const mdast = parser.parse(prepared.text) as unknown as AnyNode;
	containers(mdast);
	embeds(mdast, (message) => warnings.push(message));
	restoreUnclaimedDirectives(mdast, prepared.text);
	const heads = headings(mdast);
	const excerpt = firstParagraph(mdast);

	keepCodeMeta(mdast);
	const htmlTree = (await toHtmlTree.run(mdast as any)) as unknown as AnyNode;
	dropTableWhitespace(htmlTree);
	const hast = (await parseRawHtml.run(htmlTree as any)) as unknown as AnyNode;
	await highlightCode(hast, options.themes);
	codeGroups(hast);
	const rewritten = rewriteLinks(hast, options.links);
	const links = rewritten.links.map((l) => ({...l, line: sourceLine(l.line)}));
	const assets = rewritten.assets;
	const ids = collectIds(hast);
	// An `<h1>` written as raw HTML counts too (a README-style page often
	// opens with one), so the layout does not add a second.
	if (!heads.hasH1) {
		let rawH1 = null as AnyNode | null;
		walk(hast, (node) => {
			if (!rawH1 && isElement(node, 'h1')) rawH1 = node;
		});
		if (rawH1) {
			heads.hasH1 = true;
			heads.title ??= textOf(rawH1).trim() || null;
		}
	}
	const html = stringifier.stringify(hast as any);

	return {
		html,
		frontmatter,
		headingTitle: heads.title,
		hasH1: heads.hasH1,
		headings: heads.headings,
		excerpt,
		links,
		ids,
		assets,
		warnings,
	};
}
