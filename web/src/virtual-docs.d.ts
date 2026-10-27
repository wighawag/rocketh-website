// The module the docs engine's Vite plugin generates (docs-engine/vite-plugin.ts).
declare module 'virtual:docs' {
	import type {DocsManifest, PageLoaders} from '$lib/core/docs/types';
	export const manifest: DocsManifest;
	export const loaders: PageLoaders;
}
