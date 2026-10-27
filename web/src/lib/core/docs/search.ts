import {writable, type Readable} from 'svelte/store';

/**
 * Full-text search over the site, through Pagefind's browser API.
 *
 * The index lives at `/pagefind/`: written by `docs-engine/postbuild.js` for
 * a build, served from memory by the dev server under `vite dev`. Either way
 * this module only needs to be told where `pagefind.js` is.
 */

export type SearchHit = {
	/** Site path, as Pagefind reports it (`/guide/install/#usage`). */
	url: string;
	title: string;
	/** HTML: Pagefind's excerpt with the matched words in `<mark>`. */
	excerpt: string;
};

export type SearchResult = SearchHit & {sections: SearchHit[]};

export type SearchState = {
	query: string;
	status: 'idle' | 'loading' | 'ready' | 'error';
	results: SearchResult[];
	error: string | null;
};

type PagefindApi = {
	options: (options: Record<string, unknown>) => Promise<void>;
	init: () => Promise<void>;
	debouncedSearch: (
		query: string,
		options?: Record<string, unknown>,
		timeout?: number,
	) => Promise<{results: {data: () => Promise<PagefindData>}[]} | null>;
};

type PagefindData = {
	url: string;
	excerpt: string;
	meta: {title?: string};
	sub_results?: {url: string; title: string; excerpt: string}[];
};

const MAX_RESULTS = 10;

/**
 * @param pagefindUrl absolute URL of `pagefind.js`
 */
export function createSearch(
	pagefindUrl: () => string,
): Readable<SearchState> & {
	search: (query: string) => Promise<void>;
} {
	const state = writable<SearchState>({
		query: '',
		status: 'idle',
		results: [],
		error: null,
	});
	let api: Promise<PagefindApi> | null = null;

	function load(): Promise<PagefindApi> {
		api ??= (async () => {
			const pagefind = (await import(
				/* @vite-ignore */ pagefindUrl()
			)) as PagefindApi;
			await pagefind.options({excerptLength: 24});
			await pagefind.init();
			return pagefind;
		})();
		api.catch(() => {
			api = null;
		});
		return api;
	}

	async function search(query: string): Promise<void> {
		state.update((s) => ({...s, query}));
		if (!query.trim()) {
			state.set({query, status: 'idle', results: [], error: null});
			return;
		}
		state.update((s) => ({...s, status: 'loading'}));
		try {
			const pagefind = await load();
			const found = await pagefind.debouncedSearch(query, {}, 150);
			if (found === null) return; // superseded by a newer query
			const data = await Promise.all(
				found.results.slice(0, MAX_RESULTS).map((r) => r.data()),
			);
			const results = data.map((d) => ({
				url: d.url,
				title: d.meta.title ?? d.url,
				excerpt: d.excerpt,
				sections: (d.sub_results ?? [])
					.filter((s) => s.url !== d.url && s.title !== d.meta.title)
					.slice(0, 3),
			}));
			state.update((s) =>
				s.query === query ? {query, status: 'ready', results, error: null} : s,
			);
		} catch (error) {
			let current = true;
			state.update((s) => ((current = s.query === query), s));
			if (!current) return; // a newer query owns the state now
			state.set({
				query,
				status: 'error',
				results: [],
				error:
					'Search is unavailable: the index (/pagefind/) did not load. ' +
					`(${(error as Error).message})`,
			});
		}
	}

	return {subscribe: state.subscribe, search};
}
