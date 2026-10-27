<script lang="ts">
	import {forwardingTarget} from '$lib/core/docs/redirect';
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
		/**
		 * Anchors of the old address that forward elsewhere, as written into
		 * the page: anchor id -> where to go.
		 */
		anchors?: Record<string, string>;
	}

	let {href, canonical, anchors = {}}: Props = $props();

	let anchor: HTMLAnchorElement | undefined = $state();

	// The reader's `#anchor` decides first (see `forwardingTarget`).
	$effect(() => {
		if (!anchor) return;
		const to = forwardingTarget(anchor.href, window.location.hash, anchors);
		window.location.replace(new URL(to, window.location.href).href);
	});

	// The same thing as an inline script, for the prerendered file: it runs
	// before the meta refresh is acted on.
	let script = $derived(
		`<script>(function(){var t=${JSON.stringify(href).replace(/</g, '\\u003c')},` +
			`a=${JSON.stringify(anchors).replace(/</g, '\\u003c')},h=location.hash,i;` +
			`try{i=decodeURIComponent(h.slice(1))}catch(e){i=''}` +
			`if(i&&Object.prototype.hasOwnProperty.call(a,i)){location.replace(a[i]);return}` +
			`location.replace(t.indexOf('#')<0?t+h:t)})()</` +
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
