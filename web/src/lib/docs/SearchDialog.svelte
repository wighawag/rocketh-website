<script lang="ts">
	import * as Command from '$lib/shadcn/ui/command';
	import type {SearchState} from '$lib/core/docs/search';
	import type {Readable} from 'svelte/store';

	interface Props {
		open: boolean;
		search: Readable<SearchState> & {search: (query: string) => void};
		/** Turns a site path into a link for this deployment (`route()`). */
		link: (path: string) => string;
		go: (href: string) => void;
	}

	let {open = $bindable(false), search, link, go}: Props = $props();

	let query = $state('');

	function choose(href: string) {
		open = false;
		go(href);
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			open = !open;
		}
	}}
/>

<Command.Dialog
	bind:open
	shouldFilter={false}
	title="Search"
	description="Search the documentation"
>
	<Command.Input
		placeholder="Search the docs..."
		bind:value={query}
		oninput={() => search.search(query)}
		data-testid="search-input"
	/>
	<Command.List class="max-h-[60vh]">
		{#if $search.status === 'error'}
			<p class="p-4 text-sm text-destructive">{$search.error}</p>
		{:else if $search.query && $search.status === 'ready' && $search.results.length === 0}
			<Command.Empty>No results for "{$search.query}".</Command.Empty>
		{:else if !$search.query}
			<p class="p-4 text-sm text-muted-foreground">
				Type to search every page.
			</p>
		{/if}
		{#each $search.results as result (result.url)}
			<Command.Group heading={result.title}>
				<Command.Item
					value={result.url}
					onSelect={() => choose(link(result.url))}
					class="flex-col items-start gap-1"
					data-testid="search-result"
				>
					<span class="font-medium">{result.title}</span>
					<!-- Pagefind's excerpt: the page's own text, matches in <mark>. -->
					<span class="search-excerpt text-xs text-muted-foreground"
						>{@html result.excerpt}</span
					>
				</Command.Item>
				{#each result.sections as section (section.url)}
					<Command.Item
						value={section.url}
						onSelect={() => choose(link(section.url))}
						class="flex-col items-start gap-1 pl-6"
					>
						<span class="text-sm">{section.title}</span>
						<span class="search-excerpt text-xs text-muted-foreground"
							>{@html section.excerpt}</span
						>
					</Command.Item>
				{/each}
			</Command.Group>
		{/each}
	</Command.List>
</Command.Dialog>
