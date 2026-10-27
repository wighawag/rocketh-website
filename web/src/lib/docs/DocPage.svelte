<script lang="ts">
	import * as Breadcrumb from '$lib/shadcn/ui/breadcrumb';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import {
		breadcrumb,
		editLink,
		findSection,
		neighbours,
	} from '$lib/core/docs/navigation';
	import type {DocModule, DocsManifest, PageMeta} from '$lib/core/docs/types';
	import DocContent from './DocContent.svelte';
	import Sidebar from './Sidebar.svelte';
	import Toc from './Toc.svelte';

	interface Props {
		manifest: DocsManifest;
		meta: PageMeta;
		doc: DocModule;
		link: (path: string) => string;
	}

	let {manifest, meta, doc, link}: Props = $props();

	let section = $derived(findSection(manifest, meta.route));
	let crumbs = $derived(breadcrumb(manifest, meta.route));
	let around = $derived(neighbours(manifest, meta.route));
	let edit = $derived(editLink(manifest, meta));
	let showSidebar = $derived(
		meta.layout === 'doc' && !!section?.sidebar.length,
	);
	let showToc = $derived(
		meta.layout !== 'page' && meta.toc && doc.headings.length > 0,
	);
</script>

<div class="mx-auto flex w-full max-w-[90rem]">
	{#if showSidebar && section}
		<aside
			class="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r py-6 pr-3 pl-4 lg:block"
		>
			<Sidebar items={section.sidebar} current={meta.route} {link} />
		</aside>
	{/if}

	<div class="flex min-w-0 flex-1 gap-10 px-4 py-8 sm:px-8">
		<div class="min-w-0 flex-1">
			<article class="mx-auto max-w-3xl" data-pagefind-body>
				{#if crumbs.length > 1}
					<Breadcrumb.Root class="mb-6" data-pagefind-ignore>
						<Breadcrumb.List>
							{#each crumbs as crumb, i (i)}
								{#if i > 0}<Breadcrumb.Separator />{/if}
								<Breadcrumb.Item>
									{#if i === crumbs.length - 1 || !crumb.link}
										<Breadcrumb.Page>{crumb.text}</Breadcrumb.Page>
									{:else}
										<Breadcrumb.Link href={link(crumb.link)}
											>{crumb.text}</Breadcrumb.Link
										>
									{/if}
								</Breadcrumb.Item>
							{/each}
						</Breadcrumb.List>
					</Breadcrumb.Root>
				{/if}

				<div class="docs-prose prose max-w-none">
					{#if !doc.hasH1}<h1>{doc.title}</h1>{/if}
					<DocContent html={doc.html} />
				</div>
			</article>

			<footer class="mx-auto mt-12 max-w-3xl space-y-6" data-pagefind-ignore>
				{#if edit}
					<a
						href={edit.href}
						target="_blank"
						rel="noreferrer"
						class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
						data-testid="edit-link"
					>
						<PencilIcon class="size-4" />{edit.text}
					</a>
				{/if}
				{#if around.prev || around.next}
					<nav
						class="grid gap-4 border-t pt-6 sm:grid-cols-2"
						aria-label="Previous and next pages"
					>
						{#if around.prev}
							<a
								href={link(around.prev.link)}
								class="group rounded-lg border p-4 transition-colors hover:bg-accent"
								rel="prev"
							>
								<span
									class="flex items-center gap-1 text-xs text-muted-foreground"
									><ChevronLeftIcon class="size-3" />Previous</span
								>
								<span class="font-medium">{around.prev.text}</span>
							</a>
						{:else}
							<span></span>
						{/if}
						{#if around.next}
							<a
								href={link(around.next.link)}
								class="group rounded-lg border p-4 text-right transition-colors hover:bg-accent"
								rel="next"
							>
								<span
									class="flex items-center justify-end gap-1 text-xs text-muted-foreground"
									>Next<ChevronRightIcon class="size-3" /></span
								>
								<span class="font-medium">{around.next.text}</span>
							</a>
						{/if}
					</nav>
				{/if}
			</footer>
		</div>

		{#if showToc}
			<aside
				class="sticky top-22 hidden max-h-[calc(100dvh-7rem)] w-56 shrink-0 self-start overflow-y-auto xl:block"
			>
				<Toc headings={doc.headings} />
			</aside>
		{/if}
	</div>
</div>
