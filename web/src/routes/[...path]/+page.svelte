<script lang="ts">
	import Head from '$lib/Head.svelte';
	import DocPage from '$lib/docs/DocPage.svelte';
	import HomePage from '$lib/docs/HomePage.svelte';
	import ArticlePage from '$lib/docs/ArticlePage.svelte';
	import ArticlesPage from '$lib/docs/ArticlesPage.svelte';
	import RedirectPage from '$lib/docs/RedirectPage.svelte';
	import {latest, pageUpdates} from '$lib/core/docs/live';
	import {docs, route} from '$lib';
	import {url} from '$lib/kit/paths';
	import {name, canonicalURL} from '../../web-config.json';

	let {data} = $props();

	// Under `vite dev`, an edited page is swapped in place (core/docs/live.ts).
	let doc = $derived(data.doc ? latest(data.doc, $pageUpdates) : null);
	// The site's home page is titled by the site alone. Any other page, a
	// section's landing page with `layout: home` included, by its own title
	// first, so its tab and its social card say which page it is.
	let title = $derived(
		data.redirect
			? `Moved | ${name}`
			: !doc || data.route === docs.manifest.base
				? name
				: `${doc.title} | ${name}`,
	);
</script>

<Head
	{title}
	description={data.meta?.description || undefined}
	type={data.meta?.layout === 'article' ? 'article' : 'website'}
	image={data.meta?.image
		? new URL(data.meta.image, canonicalURL).href
		: undefined}
	home={data.route === docs.manifest.base}
/>

{#if data.redirect}
	<RedirectPage
		href={route(data.redirect)}
		canonical={new URL(data.redirect, canonicalURL).href}
	/>
{:else if data.isArticleList}
	<ArticlesPage
		manifest={docs.manifest}
		{doc}
		link={route}
		feed={url('/feed.xml')}
	/>
{:else if doc && data.meta}
	{#if data.meta.layout === 'home'}
		<HomePage {doc} link={route} asset={url} />
	{:else if data.meta.layout === 'article'}
		<ArticlePage manifest={docs.manifest} meta={data.meta} {doc} link={route} />
	{:else}
		<DocPage manifest={docs.manifest} meta={data.meta} {doc} link={route} />
	{/if}
{/if}
