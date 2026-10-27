/**
 * The site path of a catch-all route's `[...path]` parameter:
 * `guide/install` -> `/guide/install/`, `` -> `/`.
 *
 * Built from the parameter rather than from the URL, because the URL also
 * carries wherever the site is deployed (a base path, an IPFS gateway prefix)
 * and the parameter does not.
 */
export function routeOfParam(path: string | undefined): string {
	const trimmed = (path ?? '').replace(/^\/+|\/+$/g, '');
	return trimmed ? `/${trimmed}/` : '/';
}
