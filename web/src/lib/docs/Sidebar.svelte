<script lang="ts">
	import * as Collapsible from '$lib/shadcn/ui/collapsible';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import {containsRoute} from '$lib/core/docs/navigation';
	import type {NavItem} from '$lib/core/docs/types';
	import {cn} from '$lib/shadcn/utils';

	interface Props {
		items: NavItem[];
		/** The current page's site path. */
		current: string;
		link: (path: string) => string;
		onnavigate?: () => void;
	}

	let {items, current, link, onnavigate}: Props = $props();

	const isCurrent = (item: NavItem) =>
		!!item.link && item.link.replace(/\/$/, '') === current.replace(/\/$/, '');
</script>

{#snippet entry(item: NavItem)}
	<a
		href={link(item.link!)}
		onclick={onnavigate}
		aria-current={isCurrent(item) ? 'page' : undefined}
		class={cn(
			'block flex-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
			isCurrent(item) && 'bg-accent font-medium text-foreground',
		)}>{item.text}</a
	>
{/snippet}

{#snippet list(entries: NavItem[], depth: number)}
	<ul class={cn('space-y-0.5', depth > 0 && 'ml-3 border-l pl-2')}>
		{#each entries as item (item.text + (item.link ?? ''))}
			<li>
				{#if item.items?.length}
					<Collapsible.Root
						open={!item.collapsed || containsRoute(item, current)}
					>
						<div class="flex items-center">
							{#if item.link}
								{@render entry(item)}
							{:else}
								<span
									class="flex-1 px-2 py-1.5 text-sm font-semibold text-foreground"
									>{item.text}</span
								>
							{/if}
							<Collapsible.Trigger
								class="group rounded-md p-1 text-muted-foreground hover:bg-accent"
								aria-label={`Toggle ${item.text}`}
							>
								<ChevronRightIcon
									class="size-4 transition-transform group-data-[state=open]:rotate-90"
								/>
							</Collapsible.Trigger>
						</div>
						<Collapsible.Content class="mt-0.5">
							{@render list(item.items, depth + 1)}
						</Collapsible.Content>
					</Collapsible.Root>
				{:else if item.link}
					{@render entry(item)}
				{:else}
					<span class="block px-2 py-1.5 text-sm font-semibold"
						>{item.text}</span
					>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<nav aria-label="Section navigation" data-testid="sidebar">
	{@render list(items, 0)}
</nav>
