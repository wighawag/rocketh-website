<script lang="ts">
	import {page} from '$app/state';
	import {Button} from '$lib/shadcn/ui/button';
	import {docs, route} from '$lib';

	const titles: Record<number, string> = {
		404: 'Page not found',
		500: 'Server error',
		403: 'Access denied',
		401: 'Unauthorized',
	};
</script>

<svelte:head>
	<title>{page.status} | {titles[page.status] ?? 'Something went wrong'}</title>
</svelte:head>

<div
	class="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center"
	data-testid="error-page"
>
	<p class="text-7xl font-bold text-muted-foreground">{page.status}</p>
	<h1 class="text-2xl font-semibold tracking-tight">
		{titles[page.status] ?? 'Something went wrong'}
	</h1>
	<p class="text-muted-foreground">
		{#if page.status === 404}
			There is no page at this address. It may have moved: try the search (Ctrl
			K), or start again from the home page.
		{:else}
			{page.error?.message || 'An unexpected error occurred.'}
		{/if}
	</p>
	<div class="mt-4 flex gap-3">
		<Button href={route(docs.manifest.base)}>Go home</Button>
		<Button variant="outline" onclick={() => window.location.reload()}
			>Try again</Button
		>
	</div>
</div>
