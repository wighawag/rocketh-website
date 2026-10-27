import type {EmbedRegistry} from '$lib/core/docs/enhance';

/**
 * What a page may embed. See "Embeds" in the README for the convention.
 *
 * Add an entry here, then use it from Markdown:
 *
 *     ::component{name=Counter start=3}
 *     <docs-counter start="3"></docs-counter>
 *     <hello-element name="reader"></hello-element>
 *
 * Every loader is a dynamic import, so only the pages that use an embed
 * download it.
 */
export const embeds: EmbedRegistry = {
	// A Svelte component, by directive name and by tag.
	Counter: {component: () => import('./Counter.svelte'), tag: 'docs-counter'},
	// A custom element: the page uses the tag, the site loads its script.
	'hello-element': {
		element: () => import('./hello-element'),
		tag: 'hello-element',
	},
};
