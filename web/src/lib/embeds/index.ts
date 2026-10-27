import type {EmbedRegistry} from '$lib/core/docs/enhance';

/**
 * What a page may embed. See "Embeds" in the README for the convention.
 *
 * `<rocketh-playground>` is a custom element: the page holds the tag, and this
 * entry says which script defines it. That script is imported only on the
 * pages that contain the tag (`documentation/index.md` today).
 *
 * `@rocketh/playground/element` is NOT an npm release: `vite.plugins.ts`
 * resolves it to the build in the rocketh checkout the content comes from, so
 * the widget is always the one of the same rocketh commit as the page.
 */
export const embeds: EmbedRegistry = {
	'rocketh-playground': {
		element: () => import('@rocketh/playground/element'),
		tag: 'rocketh-playground',
	},
};
