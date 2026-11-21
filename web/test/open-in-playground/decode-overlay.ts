/**
 * The playground's reading of a `2.` link value, copied from
 * rocketh-playground's `web/src/lib/playground/project/share-link.ts`
 * (`decodeOverlay` and what it uses), so the tests here open a link the way
 * the playground does, over the base the link names. A test passes its own
 * stand-in `bases`, different from each other, so the files a link opens
 * show which base it named. Only the tests use it: the site writes links, it
 * never reads them.
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

/** A `2.` link the playground cannot read because it was written for a newer one. */
export class NewerLinkError extends ShareLinkError {
	constructor() {
		super(
			'it needs a newer version of the playground than this one; reload the page to open it',
		);
		this.name = 'NewerLinkError';
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

/** The bases a `2.` link may name; without one, it opens over the starting project. */
const OVERLAY_BASES = ['bare'];

/** What a `2.` value's files go over: `starting` without `base`, `bare` with `"base": "bare"`. */
export type LinkBases = {starting: ProjectFiles; bare: ProjectFiles};

/** The keys a `2.` payload may hold. */
const OVERLAY_KEYS = ['base', 'files', 'select'];

/**
 * What a `2.` value opens: its base (`bases.starting`, or `bases.bare` for
 * `"base": "bare"`) with the value's files over it, and its `select`, which
 * must name one of the resulting files. Throws a `ShareLinkError` saying why
 * it cannot: a `NewerLinkError` for a key or a `base` the playground does not
 * know.
 */
export function decodeOverlay(value: string, bases: LinkBases): LinkedProject {
	if (!value.startsWith(OVERLAY_VERSION))
		throw new ShareLinkError('it is not a project link of this playground');
	const content = inflateJSON(value.slice(OVERLAY_VERSION.length));
	if (!isObject(content) || !('files' in content))
		throw new ShareLinkError('it holds no project files');
	const {base: name} = content;
	if (name !== undefined && typeof name !== 'string')
		throw new ShareLinkError(
			`its base is ${JSON.stringify(name)}, which is not a base's name`,
		);
	if (Object.keys(content).some((key) => !OVERLAY_KEYS.includes(key)))
		throw new NewerLinkError();
	if (name !== undefined && !OVERLAY_BASES.includes(name))
		throw new NewerLinkError();
	const base = name === 'bare' ? bases.bare : bases.starting;
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
