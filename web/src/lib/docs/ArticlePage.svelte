<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import {editLink} from '$lib/core/docs/navigation';
	import type {DocModule, DocsManifest, PageMeta} from '$lib/core/docs/types';
	import DocContent from './DocContent.svelte';
	import {formatDate} from './format';

	interface Props {
		manifest: DocsManifest;
		meta: PageMeta;
		doc: DocModule;
		link: (path: string) => string;
	}

	let {manifest, meta, doc, link}: Props = $props();

	let edit = $derived(editLink(manifest, meta));
</script>

<div class="mx-auto max-w-3xl px-4 py-12 sm:px-8">
	{#if manifest.articles}
		<a
			href={link(manifest.articles)}
			class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			><ChevronLeftIcon class="size-4" />All articles</a
		>
	{/if}
	<article class="mt-6" data-pagefind-body>
		{#if meta.date}
			<time datetime={meta.date} class="text-sm text-muted-foreground"
				>{formatDate(meta.date)}</time
			>
		{/if}
		<div class="docs-prose prose max-w-none">
			{#if !doc.hasH1}<h1>{doc.title}</h1>{/if}
			<DocContent html={doc.html} />
		</div>
	</article>
	{#if edit}
		<a
			href={edit.href}
			target="_blank"
			rel="noreferrer"
			class="mt-12 inline-block text-sm text-muted-foreground hover:text-foreground"
			>{edit.text}</a
		>
	{/if}
</div>
