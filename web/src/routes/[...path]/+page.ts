import {error} from '@sveltejs/kit';
import {docs} from '$lib';
import {findPage} from '$lib/core/docs/navigation';
import {routeOfParam} from '$lib/core/docs/routes';
import type {EntryGenerator, PageLoad} from './$types';

/**
 * Every page of the content, plus the article list when the articles folder
 * has no `index.md` of its own. The prerender crawl starts here and follows
 * every link, which is what fails the build on a dead one.
 */
export const entries: EntryGenerator = () => {
	const routes = new Set(docs.manifest.pages.map((p) => p.route));
	if (docs.manifest.articles) routes.add(docs.manifest.articles);
	return [...routes].map((r) => ({path: r.replace(/^\/|\/$/g, '')}));
};

export const load: PageLoad = async ({params}) => {
	const route = routeOfParam(params.path);
	const meta = findPage(docs.manifest, route) ?? null;
	const loader = meta ? docs.loaders[meta.route] : undefined;
	const isArticleList = route === docs.manifest.articles;
	if (!loader && !isArticleList) error(404, 'Page not found');
	const doc = loader ? (await loader()).default : null;
	return {route, meta, doc, isArticleList};
};
