import type {PageMeta} from './types.js';

/**
 * Everything interpolated into the feed goes through this. A single `&` or `<`
 * in a title is enough to produce a feed no reader will parse.
 */
export function escapeXML(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function utc(date: string | null): string {
	const parsed = date ? new Date(`${date.slice(0, 10)}T00:00:00Z`) : null;
	return (
		parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(0)
	).toUTCString();
}

/** An RSS 2.0 document for the articles, newest first. */
export function renderFeed(options: {
	title: string;
	description: string;
	/** Site origin (and base path), e.g. `https://example.com`. */
	host: string;
	items: PageMeta[];
}): string {
	const host = options.host.replace(/\/$/, '');
	// The newest article's date rather than the build time: a static site
	// published to IPFS would otherwise change hash on every rebuild.
	const lastBuildDate = utc(options.items.find((i) => i.date)?.date ?? null);
	// An article without a `date` has no place in a dated feed.
	const items = options.items
		.filter((item) => item.date)
		.map((item) => {
			const link = `${host}${item.route}`;
			return `<item>
<guid isPermaLink="true">${escapeXML(link)}</guid>
<title>${escapeXML(item.title)}</title>
<link>${escapeXML(link)}</link>
<description>${escapeXML(item.description || item.title)}</description>
<pubDate>${utc(item.date)}</pubDate>
</item>`;
		})
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escapeXML(options.title)}</title>
<description>${escapeXML(options.description)}</description>
<link>${escapeXML(host)}/</link>
<language>en</language>
<lastBuildDate>${lastBuildDate}</lastBuildDate>
<atom:link href="${escapeXML(host)}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>
`;
}
