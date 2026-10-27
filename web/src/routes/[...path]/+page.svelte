<script lang="ts">
	import Head from '$lib/Head.svelte';
	import DocPage from '$lib/docs/DocPage.svelte';
	import HomePage from '$lib/docs/HomePage.svelte';
	import ArticlePage from '$lib/docs/ArticlePage.svelte';
	import ArticlesPage from '$lib/docs/ArticlesPage.svelte';
	import {latest, pageUpdates} from '$lib/core/docs/live';
	import {docs, route} from '$lib';
	import {url} from '$lib/kit/paths';
	import {name, canonicalURL} from '../../web-config.json';

	let {data} = $props();

	// Under `vite dev`, an edited page is swapped in place (core/docs/live.ts).
	let doc = $derived(data.doc ? latest(data.doc, $pageUpdates) : null);
	let title = $derived(
		data.meta?.layout === 'home' || !doc ? name : `${doc.title} | ${name}`,
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

{#if data.isArticleList}
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
