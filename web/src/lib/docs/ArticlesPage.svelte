<script lang="ts">
	import RssIcon from '@lucide/svelte/icons/rss';
	import {articles, emptyArticles} from '$lib/core/docs/navigation';
	import type {DocModule, DocsManifest} from '$lib/core/docs/types';
	import DocContent from './DocContent.svelte';
	import {formatDate} from './format';

	interface Props {
		manifest: DocsManifest;
		/** The articles folder's own `index.md`, when it has one. */
		doc: DocModule | null;
		link: (path: string) => string;
		feed: string;
	}

	let {manifest, doc, link, feed}: Props = $props();

	let list = $derived(articles(manifest));
	let empty = $derived(emptyArticles(manifest));
</script>

<div class="mx-auto max-w-3xl px-4 py-12 sm:px-8">
	<div class="docs-prose prose max-w-none">
		{#if !doc}<h1>Articles</h1>{:else if !doc.hasH1}<h1>{doc.title}</h1>{/if}
		{#if doc}<DocContent html={doc.html} />{/if}
	</div>
	<a
		href={feed}
		class="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
		><RssIcon class="size-4" />RSS feed</a
	>
	<ul class="mt-8 divide-y" data-testid="article-list">
		{#each list as article (article.route)}
			<li class="py-6">
				{#if article.date}
					<time datetime={article.date} class="text-sm text-muted-foreground"
						>{formatDate(article.date)}</time
					>
				{/if}
				{#if article.draft}
					<span
						class="ml-2 rounded border px-1.5 py-0.5 text-xs text-muted-foreground"
						data-testid="draft-badge">Draft</span
					>
				{/if}
				<h2 class="mt-1 text-xl font-semibold tracking-tight">
					<a href={link(article.route)} class="hover:underline"
						>{article.title}</a
					>
				</h2>
				{#if article.description}
					<p class="mt-2 text-muted-foreground">{article.description}</p>
				{/if}
			</li>
		{:else}
			<li class="py-6 text-muted-foreground" data-testid="articles-empty">
				{empty === 'coming-soon' ? 'Coming soon.' : 'No articles yet.'}
			</li>
		{/each}
	</ul>
</div>
