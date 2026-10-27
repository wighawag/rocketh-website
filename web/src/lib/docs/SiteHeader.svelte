<script lang="ts">
	import {Button} from '$lib/shadcn/ui/button';
	import * as Sheet from '$lib/shadcn/ui/sheet';
	import {Kbd} from '$lib/shadcn/ui/kbd';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import SearchIcon from '@lucide/svelte/icons/search';
	import {findSection} from '$lib/core/docs/navigation';
	import type {DocsManifest} from '$lib/core/docs/types';
	import {cn} from '$lib/shadcn/utils';
	import Sidebar from './Sidebar.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import SocialIcon from './SocialIcon.svelte';
	import {hasSocialIcon as hasIcon} from './social';

	interface Props {
		manifest: DocsManifest;
		/** The current page's site path. */
		current: string;
		siteName: string;
		link: (path: string) => string;
		onsearch: () => void;
	}

	let {manifest, current, siteName, link, onsearch}: Props = $props();

	let menuOpen = $state(false);
	let section = $derived(findSection(manifest, current));
	let navSections = $derived(manifest.sections.filter((s) => s.nav));
</script>

<header
	class="sticky top-0 z-40 h-14 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
	data-pagefind-ignore
>
	<div class="mx-auto flex h-full max-w-[90rem] items-center gap-2 px-4">
		<Sheet.Root bind:open={menuOpen}>
			<Sheet.Trigger>
				{#snippet child({props})}
					<Button
						{...props}
						variant="ghost"
						size="icon"
						class="lg:hidden"
						aria-label="Open the menu"
						data-testid="menu-button"><MenuIcon class="size-5" /></Button
					>
				{/snippet}
			</Sheet.Trigger>
			<Sheet.Content side="left" class="overflow-y-auto">
				<Sheet.Header>
					<Sheet.Title>{siteName}</Sheet.Title>
				</Sheet.Header>
				<div class="space-y-6 px-4 pb-8">
					<nav class="flex flex-col gap-1" aria-label="Sections">
						{#each navSections as s (s.dir)}
							<a
								href={link(s.link)}
								onclick={() => (menuOpen = false)}
								class={cn(
									'rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent',
									section?.dir === s.dir && 'bg-accent',
								)}>{s.label}</a
							>
						{/each}
					</nav>
					{#if section?.sidebar.length}
						<Sidebar
							items={section.sidebar}
							{current}
							{link}
							onnavigate={() => (menuOpen = false)}
						/>
					{/if}
				</div>
			</Sheet.Content>
		</Sheet.Root>

		<a href={link(manifest.base)} class="mr-4 font-semibold tracking-tight"
			>{siteName}</a
		>

		<nav class="hidden items-center gap-1 md:flex" aria-label="Sections">
			{#each navSections as s (s.dir)}
				<a
					href={link(s.link)}
					aria-current={section?.dir === s.dir ? 'true' : undefined}
					class={cn(
						'rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
						section?.dir === s.dir && 'font-medium text-foreground',
					)}>{s.label}</a
				>
			{/each}
		</nav>

		<div class="ml-auto flex items-center gap-1">
			<Button
				variant="outline"
				class="h-9 w-9 justify-start gap-2 px-2 text-muted-foreground sm:w-56 sm:px-3"
				onclick={onsearch}
				aria-label="Search"
				data-testid="search-button"
			>
				<SearchIcon class="size-4" />
				<span class="hidden sm:inline">Search...</span>
				<Kbd class="ml-auto hidden sm:inline-flex">Ctrl K</Kbd>
			</Button>
			{#each manifest.socialLinks as social (social.link)}
				<Button
					variant="ghost"
					size={hasIcon(social.icon) ? 'icon' : 'default'}
					href={social.link}
					target="_blank"
					rel="noreferrer"
					aria-label={social.label}
					data-testid="social-link"
				>
					{#if hasIcon(social.icon)}
						<SocialIcon name={social.icon!} />
					{:else}
						{social.label}
					{/if}
				</Button>
			{/each}
			<ThemeToggle />
		</div>
	</div>
</header>
