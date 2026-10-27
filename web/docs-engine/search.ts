/**
 * Pagefind, both ways.
 *
 * BUILD: `scripts/docs-postbuild.js` indexes the prerendered HTML in `build/`,
 * the way Pagefind is meant to be used: what is searched is exactly what was
 * published, and `data-pagefind-body` (on the article element of a page)
 * keeps the header, sidebar and footer out of the results.
 *
 * DEV: there is no built HTML under `vite dev`, so the dev server builds an
 * index in memory from the same rendered Markdown, through Pagefind's Node
 * API, and serves it at `/pagefind/` where the build puts it. The search UI
 * cannot tell the difference. It is rebuilt (lazily, on the next search) after
 * a page changes.
 */
import type {DocsSite} from './site.js';

type PagefindModule = typeof import('pagefind');

/** A page as Pagefind should see it: title and body, nothing else. */
export function searchDocument(
	title: string,
	html: string,
	hasH1: boolean,
): string {
	const escaped = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
	return `<!doctype html><html lang="en"><head><title>${escaped}</title></head><body><article data-pagefind-body>${
		hasH1 ? '' : `<h1>${escaped}</h1>`
	}${html}</article></body></html>`;
}

export function createDevSearch(pages: () => ReturnType<DocsSite['pages']>) {
	let files: Promise<Map<string, Uint8Array>> | null = null;
	let pagefind: PagefindModule | null = null;

	async function build(): Promise<Map<string, Uint8Array>> {
		pagefind ??= await import('pagefind');
		const {index, errors} = await pagefind.createIndex({});
		if (!index) throw new Error(`pagefind: ${errors.join(', ')}`);
		for (const entry of pages()) {
			if (entry.meta.layout === 'home') continue;
			await index.addHTMLFile({
				url: entry.route,
				content: searchDocument(
					entry.meta.title,
					entry.result.html,
					entry.result.hasH1,
				),
			});
		}
		const out = await index.getFiles();
		await index.deleteIndex();
		return new Map(
			out.files.map((f) => [f.path.replace(/\\/g, '/'), f.content]),
		);
	}

	return {
		/** A file of the index, by its path under `/pagefind/`. */
		async file(path: string): Promise<Uint8Array | undefined> {
			files ??= build().catch((error) => {
				files = null;
				throw error;
			});
			return (await files).get(path);
		},
		invalidate() {
			files = null;
		},
		async close() {
			if (pagefind) await pagefind.close();
		},
	};
}
