/**
 * The playground's reading of a `2.` link value, copied from
 * rocketh-playground's `web/src/lib/playground/project/share-link.ts`
 * (`decodeOverlay` and what it uses), so the tests here open a link the way
 * the playground does. Only the tests use it: the site writes links, it never
 * reads them.
 */
import {inflateSync, strFromU8} from 'fflate';

const OVERLAY_VERSION = '2.';

type ProjectFiles = Record<string, string>;

/** A link that does not hold a project the playground can open. */
export class ShareLinkError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ShareLinkError';
	}
}

function fromBase64URL(text: string): Uint8Array {
	if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1)
		throw new ShareLinkError('it is not base64url');
	const binary = atob(
		text.replace(/-/g, '+').replace(/_/g, '/') +
			'='.repeat((4 - (text.length % 4)) % 4),
	);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/**
 * Whether `path` may be a project file from a link: relative, `/`-separated,
 * no `..`, and not a deployment record.
 */
function isProjectPath(path: string): boolean {
	if (path === '' || path.startsWith('/') || path.includes('\\')) return false;
	const segments = path.split('/');
	if (segments.some((s) => s === '' || s === '.' || s === '..')) return false;
	return segments[0] !== 'deployments';
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** The JSON a value holds after its version prefix: base64url, deflated. */
function inflateJSON(payload: string): unknown {
	let text: string;
	try {
		text = strFromU8(inflateSync(fromBase64URL(payload)));
	} catch {
		throw new ShareLinkError('it is corrupted or cut short');
	}
	try {
		return JSON.parse(text);
	} catch {
		throw new ShareLinkError('it is corrupted or cut short');
	}
}

/** `content` as project files, every path one a link may hold. */
function projectFiles(content: unknown, empty: boolean): ProjectFiles {
	if (!isObject(content)) throw new ShareLinkError('it holds no project files');
	const entries = Object.entries(content);
	if (entries.length === 0 && !empty)
		throw new ShareLinkError('it holds no project files');
	for (const [path, text] of entries) {
		if (typeof text !== 'string')
			throw new ShareLinkError(`its file ${path} is not text`);
		if (!isProjectPath(path))
			throw new ShareLinkError(
				`it holds a file at ${JSON.stringify(path)}, which is not a project path`,
			);
	}
	return Object.fromEntries(entries) as ProjectFiles;
}

export type LinkedProject = {files: ProjectFiles; select?: string};

/**
 * What a `2.` value opens: `base` (the starting project) with the value's
 * files over it, and its `select`, which must name one of the resulting files.
 */
export function decodeOverlay(
	value: string,
	base: ProjectFiles,
): LinkedProject {
	if (!value.startsWith(OVERLAY_VERSION))
		throw new ShareLinkError('it is not a project link of this playground');
	const content = inflateJSON(value.slice(OVERLAY_VERSION.length));
	if (!isObject(content) || !('files' in content))
		throw new ShareLinkError('it holds no project files');
	const unknown = Object.keys(content).filter(
		(key) => key !== 'files' && key !== 'select',
	);
	if (unknown.length > 0)
		throw new ShareLinkError(
			`it holds ${unknown.map((k) => JSON.stringify(k)).join(', ')}, which this playground does not read`,
		);
	const files = {...base, ...projectFiles(content.files, true)};
	const {select} = content;
	if (select === undefined) return {files};
	if (typeof select !== 'string' || !Object.hasOwn(files, select)) {
		throw new ShareLinkError(
			`it selects ${JSON.stringify(select)}, which is not one of its files`,
		);
	}
	return {files, select};
}

/** The `project` value of a link to the playground, or null when it has none. */
export function projectValueOf(href: string): string | null {
	const hash = href.indexOf('#');
	if (hash === -1) return null;
	for (const piece of href.slice(hash + 1).split('&')) {
		const at = piece.indexOf('=');
		if (at !== -1 && piece.slice(0, at) === 'project')
			return piece.slice(at + 1);
	}
	return null;
}
