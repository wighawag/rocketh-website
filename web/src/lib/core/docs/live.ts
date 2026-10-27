import {readable, type Readable} from 'svelte/store';
import type {DocModule} from './types.js';

/**
 * Pages edited under `vite dev`, by route.
 *
 * Each page module accepts its own hot updates and announces the new version
 * with a `docs:page-update` event (see `DocsSite.moduleCode`). A page shows
 * the newest version it has, which also covers coming back to a page edited
 * while elsewhere: the original import is still cached by the browser, the
 * update is here. In a production build the event never fires.
 */
export const pageUpdates: Readable<Record<string, DocModule>> = readable<
	Record<string, DocModule>
>({}, (set, update) => {
	if (typeof window === 'undefined') return;
	const listener = (event: Event) => {
		const doc = (event as CustomEvent<DocModule>).detail;
		update((all) => ({...all, [doc.route]: doc}));
	};
	window.addEventListener('docs:page-update', listener);
	return () => window.removeEventListener('docs:page-update', listener);
});

/** The newest version of a page: the hot-updated one if there is one. */
export function latest(
	doc: DocModule,
	updates: Record<string, DocModule>,
): DocModule {
	return updates[doc.route] ?? doc;
}
