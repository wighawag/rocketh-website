import {docs} from '$lib';
import {articles} from '$lib/core/docs/navigation';
import {renderFeed} from '$lib/core/docs/feed';
import {name, description, canonicalURL} from '../../web-config.json';

export const prerender = true;
export const trailingSlash = 'never';

/**
 * The articles as RSS. Absolute URLs come from `canonicalURL` in
 * web-config.json, which a deployed site must set.
 */
export const GET = () =>
	new Response(
		renderFeed({
			title: name,
			description,
			host: canonicalURL,
			items: articles(docs.manifest),
		}),
		{headers: {'Content-Type': 'application/xml'}},
	);
