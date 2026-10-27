<script lang="ts">
	/**
	 * The forwarding page of an old address (`redirects` in docs.config.js).
	 *
	 * Three ways out, so it works everywhere a static file can be served:
	 * an inline script (first, so it keeps the reader's `#anchor`), a meta
	 * refresh for readers without JavaScript, and a plain link. The client-side
	 * effect covers arriving here by in-app navigation, where neither the
	 * inline script nor the meta refresh runs.
	 */
	interface Props {
		/** Where to go, as written into the page: relative, or external. */
		href: string;
		/** The absolute URL of the target, for `rel=canonical`. */
		canonical: string;
	}

	let {href, canonical}: Props = $props();

	let anchor: HTMLAnchorElement | undefined = $state();

	// Keep the reader's `#anchor` unless the target names its own.
	const keepHash = (target: string) =>
		target.includes('#') ? '' : window.location.hash;

	$effect(() => {
		if (anchor) window.location.replace(anchor.href + keepHash(anchor.href));
	});

	// The same thing as an inline script, for the prerendered file: it runs
	// before the meta refresh is acted on.
	let script = $derived(
		`<script>(function(){var t=${JSON.stringify(href).replace(/</g, '\\u003c')};` +
			`location.replace(t.indexOf('#')<0?t+location.hash:t)})()</` +
			`script>`,
	);
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html script}
	<meta http-equiv="refresh" content={`0; url=${href}`} />
	<meta name="robots" content="noindex" />
	<link rel="canonical" href={canonical} />
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-24 text-center" data-testid="redirect">
	<p class="text-lg">
		This page has moved to
		<a bind:this={anchor} {href} class="font-medium underline">{canonical}</a>.
	</p>
</div>
