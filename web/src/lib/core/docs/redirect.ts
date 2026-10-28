/**
 * Where a forwarding page sends a reader, given the `#anchor` they arrived
 * with. Framework-free, so the forwarding page's client-side path and its
 * tests share it; the prerendered page's inline script does the same in
 * plain JavaScript (see `RedirectPage.svelte`).
 *
 * - An anchor that moved on its own (`redirectAnchors` in the manifest) goes
 *   where it moved to, and is not carried along.
 * - Otherwise the reader goes to the address's target, keeping their anchor
 *   unless the target names its own.
 */
export function forwardingTarget(
	target: string,
	hash: string,
	anchors: Record<string, string>,
): string {
	let id = '';
	try {
		id = decodeURIComponent(hash.replace(/^#/, ''));
	} catch {
		id = '';
	}
	if (id && Object.prototype.hasOwnProperty.call(anchors, id)) {
		return anchors[id];
	}
	return target.includes('#') ? target : target + hash;
}
