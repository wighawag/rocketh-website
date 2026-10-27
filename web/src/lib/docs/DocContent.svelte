<script lang="ts">
	import {enhance} from '$lib/core/docs/enhance';
	import {embeds} from '$lib/embeds';

	let {html}: {html: string} = $props();
</script>

<!--
	The page body is HTML compiled from the author's own Markdown at build time:
	trusted content, rendered as-is (see "Raw HTML" in the README). `enhance`
	wires copy buttons, code-group tabs and embeds, and undoes it all when the
	page changes.
-->
{#key html}
	<div class="docs-content" {@attach (node) => enhance(node, embeds)}>
		{@html html}
	</div>
{/key}
