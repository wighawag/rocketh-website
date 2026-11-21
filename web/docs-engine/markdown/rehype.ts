/**
 * The HTML-level (hast) transforms: highlighted code with copy buttons, code
 * groups as tabs, and links rewritten and recorded for checking.
 */
import {existsSync, statSync} from 'node:fs';
import {join, posix} from 'node:path';
import type {
	CodeBlock,
	CodeBlockAction,
	CodeBlockActionHook,
} from '../config.js';
import {highlight, type CodeThemes} from './highlight.js';
import {relativeUrl, resolveLink, type LinkContext} from './links.js';
import {
	classesOf,
	h,
	isElement,
	text,
	textOf,
	walk,
	type AnyNode,
} from './tree.js';

/** `[label]` in a fence's info string, as VitePress code groups use it. */
function labelOf(meta: string | undefined): string | null {
	return meta?.match(/\[([^\]]+)\]/)?.[1] ?? null;
}

export type CodeBlockActions = {
	hook: CodeBlockActionHook;
	page: CodeBlock['page'];
};

/** A `codeBlockAction` that threw or returned something other than an action. */
export type CodeBlockActionError = {line: number | null; message: string};

function isAction(value: unknown): value is CodeBlockAction {
	const action = value as CodeBlockAction | null;
	return (
		typeof action === 'object' &&
		action !== null &&
		typeof action.label === 'string' &&
		action.label !== '' &&
		typeof action.href === 'string' &&
		action.href !== ''
	);
}

/**
 * The site's `codeBlockAction` for one block: the action to show, or null
 * when there is none or the hook failed (then `errors` says why).
 */
function actionFor(
	actions: CodeBlockActions,
	block: Omit<CodeBlock, 'page'>,
	line: number | null,
	errors: CodeBlockActionError[],
): CodeBlockAction | null {
	let value: unknown;
	try {
		value = actions.hook({...block, page: {...actions.page}});
	} catch (error) {
		errors.push({
			line,
			message: `codeBlockAction threw: ${error instanceof Error ? error.message : String(error)}`,
		});
		return null;
	}
	if (value === undefined || value === null) return null;
	if (!isAction(value)) {
		errors.push({
			line,
			message:
				'codeBlockAction must return nothing or `{label, href}` with two non-empty strings',
		});
		return null;
	}
	return {label: value.label, href: value.href};
}

/**
 * Every fenced code block becomes:
 *
 *     <div class="code-block" data-lang="ts">
 *       <button class="code-copy" data-copy>Copy</button>
 *       <pre class="shiki">...</pre>
 *     </div>
 *
 * The copy button is in the HTML from the start (so it costs no layout shift)
 * and is wired by one delegated listener on the client.
 *
 * With `actions`, the site's `codeBlockAction` is asked about each block, and
 * the action it returns becomes a link beside the copy button, the two in a
 * `div.code-actions`. The link carries the block's position, so `rewriteLinks`
 * resolves and checks it like any link of the page.
 */
export async function highlightCode(
	tree: AnyNode,
	themes: CodeThemes,
	actions?: CodeBlockActions,
): Promise<CodeBlockActionError[]> {
	const jobs: Promise<void>[] = [];
	const errors: CodeBlockActionError[] = [];
	walk(tree, (node, parent, index) => {
		if (!parent || !isElement(node, 'pre')) return;
		const code = node.children?.find((c) => isElement(c, 'code'));
		if (!code) return;
		const lang = classesOf(code)
			.find((c) => c.startsWith('language-'))
			?.slice('language-'.length);
		const meta =
			typeof code.properties?.dataMeta === 'string'
				? code.properties.dataMeta
				: undefined;
		const label = labelOf(meta);
		const source = textOf(code).replace(/\n$/, '');
		const action = actions
			? actionFor(
					actions,
					{lang: lang ?? null, meta: meta || null, source},
					node.position?.start.line ?? null,
					errors,
				)
			: null;
		const copy = h(
			'button',
			{
				type: 'button',
				className: ['code-copy'],
				dataCopy: '',
				ariaLabel: 'Copy code',
				dataPagefindIgnore: '',
			},
			[text('Copy')],
		);
		const header = action
			? h('div', {className: ['code-actions'], dataPagefindIgnore: ''}, [
					{
						...h(
							'a',
							{
								className: ['code-action'],
								href: action.href,
								dataPagefindIgnore: '',
							},
							[text(action.label)],
						),
						position: node.position,
					},
					copy,
				])
			: copy;
		jobs.push(
			highlight(source, lang, themes).then((pre) => {
				parent.children![index] = h(
					'div',
					{
						className: ['code-block'],
						dataLang: lang ?? 'text',
						...(label ? {dataLabel: label} : {}),
					},
					[
						header,
						h(
							'span',
							{
								className: ['code-lang'],
								dataPagefindIgnore: '',
								ariaHidden: 'true',
							},
							[text(label ?? lang ?? '')],
						),
						pre,
					],
				);
			}),
		);
		return 'skip';
	});
	await Promise.all(jobs);
	return errors;
}

/**
 * `:::code-group` (a `div.code-group` by now) becomes a tab list and panels.
 * The first panel is visible without JavaScript; the client switches tabs.
 */
export function codeGroups(tree: AnyNode): void {
	let group = 0;
	walk(tree, (node) => {
		if (!isElement(node, 'div') || !classesOf(node).includes('code-group'))
			return;
		const blocks = (node.children ?? []).filter(
			(c) => isElement(c, 'div') && classesOf(c).includes('code-block'),
		);
		const id = `code-group-${group++}`;
		const tabs = blocks.map((block, i) =>
			h(
				'button',
				{
					type: 'button',
					role: 'tab',
					id: `${id}-tab-${i}`,
					ariaSelected: i === 0 ? 'true' : 'false',
					ariaControls: `${id}-panel-${i}`,
					tabIndex: i === 0 ? 0 : -1,
					dataCodeGroupTab: String(i),
				},
				[
					text(
						String(
							block.properties?.dataLabel ??
								block.properties?.dataLang ??
								`Tab ${i + 1}`,
						),
					),
				],
			),
		);
		const panels = blocks.map((block, i) =>
			h(
				'div',
				{
					role: 'tabpanel',
					id: `${id}-panel-${i}`,
					ariaLabelledBy: `${id}-tab-${i}`,
					className: ['code-group-panel'],
					dataCodeGroupPanel: String(i),
					...(i === 0 ? {} : {hidden: true}),
				},
				[block],
			),
		);
		node.properties = {...node.properties, dataCodeGroup: ''};
		node.children = [
			h('div', {role: 'tablist', className: ['code-group-tabs']}, tabs),
			...panels,
		];
		return 'skip';
	});
}

export type LinkRecord = {
	href: string;
	line: number | null;
	/** Set when the link points at an anchor that has to exist. */
	anchor: {route: string; id: string} | null;
	/** Set when nothing at all answers the link. */
	dead: string | null;
};

export type AssetImport = {placeholder: string; file: string};

export type LinkOptions = LinkContext & {
	/** Absolute path of the content root, for images next to the page. */
	contentRoot: string;
	/**
	 * Absolute path of a content-relative file, when the content is not one
	 * folder (articles from a folder of their own). Defaults to joining it to
	 * `contentRoot`.
	 */
	fileOf?: (source: string) => string;
};

function isFile(path: string): boolean {
	try {
		return existsSync(path) && statSync(path).isFile();
	} catch {
		return false;
	}
}

/**
 * Rewrite every internal `href` and `src` relative to the page, and record
 * what each one needs to exist. Images next to the Markdown file become Vite
 * asset imports (`placeholder` is swapped for the imported URL by the module
 * the plugin generates).
 */
export function rewriteLinks(
	tree: AnyNode,
	ctx: LinkOptions,
): {links: LinkRecord[]; assets: AssetImport[]} {
	const links: LinkRecord[] = [];
	const assets: AssetImport[] = [];
	walk(tree, (node) => {
		if (node.type !== 'element') return;
		const attr =
			node.tagName === 'a' ? 'href' : node.tagName === 'img' ? 'src' : null;
		if (!attr) return;
		const value = node.properties?.[attr];
		if (typeof value !== 'string' || value === '') return;
		const line = node.position?.start.line ?? null;
		const target = resolveLink(value, ctx);
		const record = (r: Partial<LinkRecord>) =>
			links.push({href: value, line, anchor: null, dead: null, ...r});

		switch (target.kind) {
			case 'external':
				if (attr === 'href' && /^https?:/i.test(value)) {
					node.properties.target = '_blank';
					node.properties.rel = ['noreferrer'];
				}
				return;
			case 'hash':
				if (target.id) record({anchor: {route: ctx.route, id: target.id}});
				return;
			case 'page': {
				const href =
					relativeUrl(ctx.route, target.route) + target.query + target.hash;
				node.properties[attr] = href;
				if (target.hash.length > 1) {
					record({
						anchor: {
							route: target.route,
							id: decodeURIComponent(target.hash.slice(1)),
						},
					});
				}
				return;
			}
			case 'asset':
				node.properties[attr] =
					relativeUrl(ctx.route, target.sitePath) + target.query + target.hash;
				return;
			case 'dead': {
				// An image beside the Markdown file: let Vite own it.
				if (attr === 'src' && !value.startsWith('/')) {
					const source = posix.normalize(
						posix.join(posix.dirname(ctx.source), value.split(/[?#]/)[0]),
					);
					const file = ctx.fileOf
						? ctx.fileOf(source)
						: join(ctx.contentRoot, source);
					if (isFile(file)) {
						const placeholder = `__DOCS_ASSET_${assets.length}__`;
						assets.push({placeholder, file});
						node.properties[attr] = placeholder;
						return;
					}
				}
				record({dead: target.reason});
				return;
			}
		}
	});
	return {links, assets};
}

/** Every id in the page, to check `#anchor` links against. */
export function collectIds(tree: AnyNode): string[] {
	const ids: string[] = [];
	walk(tree, (node) => {
		if (node.type !== 'element') return;
		const id = node.properties?.id;
		if (typeof id === 'string') ids.push(id);
		if (node.tagName === 'a' && typeof node.properties?.name === 'string') {
			ids.push(node.properties.name);
		}
	});
	return ids;
}
