<script lang="ts">
	import {createActiveHeading} from '$lib/core/docs/toc';
	import type {Heading} from '$lib/core/docs/types';
	import {cn} from '$lib/shadcn/utils';

	let {headings}: {headings: Heading[]} = $props();

	const active = createActiveHeading();

	$effect(() => active.track(headings.map((h) => h.id)));
</script>

{#if headings.length}
	<nav aria-label="On this page" data-testid="toc">
		<p class="mb-2 text-sm font-semibold">On this page</p>
		<ul class="space-y-1 border-l text-sm">
			{#each headings as heading (heading.id)}
				<li>
					<a
						href={`#${heading.id}`}
						aria-current={$active === heading.id ? 'location' : undefined}
						class={cn(
							'-ml-px block border-l border-transparent py-0.5 text-muted-foreground transition-colors hover:text-foreground',
							heading.depth === 3 ? 'pl-6' : 'pl-3',
							$active === heading.id &&
								'border-foreground font-medium text-foreground',
						)}>{heading.text}</a
					>
				</li>
			{/each}
		</ul>
	</nav>
{/if}
