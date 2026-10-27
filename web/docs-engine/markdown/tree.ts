/**
 * Tiny helpers over unist trees (mdast and hast alike), so the pipeline does
 * not take a dependency per one-liner.
 */

/** A unist node, loosely typed: the plugins here check `type` themselves. */
export type AnyNode = {
	type: string;
	children?: AnyNode[];
	value?: string;
	position?: {start: {offset?: number; line: number}; end: {offset?: number}};
	data?: Record<string, any>;
	[key: string]: any;
};

/** Every node, depth first, with its parent and index. */
export function walk(
	node: AnyNode,
	visit: (
		node: AnyNode,
		parent: AnyNode | null,
		index: number,
	) => void | 'skip',
	parent: AnyNode | null = null,
	index = 0,
): void {
	if (visit(node, parent, index) === 'skip') return;
	const current = parent?.children?.[index] ?? node;
	const children = current.children;
	if (!children) return;
	// A visitor may REPLACE the node at its index (the replacement is then
	// walked), but must not insert or remove siblings.
	for (let i = 0; i < children.length; i++) {
		walk(children[i], visit, current, i);
	}
}

/** The concatenated text of a node, the way a reader sees it. */
export function textOf(node: AnyNode | undefined): string {
	if (!node) return '';
	if (typeof node.value === 'string') return node.value;
	return (node.children ?? []).map(textOf).join('');
}

/** A hast element. */
export function h(
	tagName: string,
	properties: Record<string, unknown> = {},
	children: AnyNode[] = [],
): AnyNode {
	return {type: 'element', tagName, properties, children};
}

/** A hast text node. */
export function text(value: string): AnyNode {
	return {type: 'text', value};
}

/** hast class list, whatever shape the property arrived in. */
export function classesOf(node: AnyNode): string[] {
	const value = node.properties?.className;
	if (Array.isArray(value)) return value.map(String);
	if (typeof value === 'string') return value.split(/\s+/);
	return [];
}

export function isElement(node: AnyNode, tagName?: string): boolean {
	return (
		node.type === 'element' &&
		(tagName === undefined || node.tagName === tagName)
	);
}
