<script lang="ts">
	import {Button} from '$lib/shadcn/ui/button';
	import * as Card from '$lib/shadcn/ui/card';
	import type {DocModule, Feature, Hero} from '$lib/core/docs/types';
	import DocContent from './DocContent.svelte';

	interface Props {
		doc: DocModule;
		/** For pages: `route()`. */
		link: (path: string) => string;
		/** For files: `url()`. */
		asset: (path: string) => string;
	}

	let {doc, link, asset}: Props = $props();

	let hero = $derived((doc.frontmatter.hero ?? {}) as Hero);
	let features = $derived((doc.frontmatter.features ?? []) as Feature[]);
	const isExternal = (href: string) => /^[a-z][a-z0-9+.-]*:|^\/\//i.test(href);
	const href = (target: string) => (isExternal(target) ? target : link(target));
</script>

<div class="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
	<section
		class="flex flex-col-reverse items-center gap-10 md:flex-row"
		data-testid="hero"
	>
		<div class="flex-1 text-center md:text-left">
			{#if hero.name}
				<h1 class="text-4xl font-bold tracking-tight sm:text-6xl">
					<span class="hero-name">{hero.name}</span>
				</h1>
			{/if}
			{#if hero.text}
				<p class="mt-4 text-2xl font-semibold tracking-tight sm:text-4xl">
					{hero.text}
				</p>
			{/if}
			{#if hero.tagline}
				<p class="mt-4 text-lg text-muted-foreground">{hero.tagline}</p>
			{/if}
			{#if hero.actions?.length}
				<div class="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
					{#each hero.actions as action (action.text)}
						<Button
							href={href(action.link)}
							variant={action.theme === 'alt' ? 'outline' : 'default'}
							size="lg"
							target={isExternal(action.link) ? '_blank' : undefined}
							rel={isExternal(action.link) ? 'noreferrer' : undefined}
							>{action.text}</Button
						>
					{/each}
				</div>
			{/if}
		</div>
		{#if hero.image}
			{@const light = hero.image.light ?? hero.image.src}
			{@const dark = hero.image.dark ?? hero.image.src}
			{#if light}
				<img
					src={asset(light)}
					alt={hero.image.alt ?? ''}
					class="w-48 sm:w-64 {dark && dark !== light ? 'dark:hidden' : ''}"
				/>
			{/if}
			{#if dark && dark !== light}
				<img
					src={asset(dark)}
					alt={hero.image.alt ?? ''}
					class="hidden w-48 sm:w-64 dark:block"
				/>
			{/if}
		{/if}
	</section>

	{#if features.length}
		<section
			class="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
			data-testid="features"
		>
			{#each features as feature (feature.title)}
				<Card.Root class="gap-2">
					<Card.Header>
						{#if feature.icon}<div class="mb-2 text-2xl">
								{feature.icon}
							</div>{/if}
						<Card.Title>
							{#if feature.link}
								<a href={href(feature.link)} class="hover:underline"
									>{feature.title}</a
								>
							{:else}
								{feature.title}
							{/if}
						</Card.Title>
						{#if feature.details}
							<Card.Description>{feature.details}</Card.Description>
						{/if}
					</Card.Header>
				</Card.Root>
			{/each}
		</section>
	{/if}

	{#if doc.html.trim()}
		<div class="docs-prose mx-auto prose mt-16 max-w-3xl">
			<DocContent html={doc.html} />
		</div>
	{/if}
</div>
