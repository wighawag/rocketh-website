<script lang="ts">
	import Notifications from '$lib/core/notifications/Notifications.svelte';
	import VersionAndInstallNotfications from '$lib/core/service-worker/VersionAndInstallNotfications.svelte';
	import NavigationProgress from '$lib/components/NavigationProgress.svelte';
	import SiteHeader from '$lib/docs/SiteHeader.svelte';
	import SearchDialog from '$lib/docs/SearchDialog.svelte';
	import {LAYERS} from '$lib/core/ui/layers';
	import {ModeWatcher} from 'mode-watcher';
	import {docs, notifications, route, search, serviceWorker} from '$lib';
	import {navigate} from '$lib/kit/navigation';
	import {routeOfParam} from '$lib/core/docs/routes';
	import {name} from '../web-config.json';
	import {navigating, page} from '$app/state';
	import '../app.css';
	let {children} = $props();

	let searchOpen = $state(false);
</script>

<ModeWatcher />

<SiteHeader
	manifest={docs.manifest}
	current={routeOfParam(page.params.path)}
	siteName={name}
	link={route}
	onsearch={() => (searchOpen = true)}
/>

<main>
	{@render children()}
</main>

<SearchDialog bind:open={searchOpen} {search} link={route} go={navigate} />

<!--
	OVERLAY LAYERS.

	Every floating surface goes in one of these, and the ORDER IS DECIDED BY THE
	NUMBERS IN app.css (`--z-layer-*`), not by the order written here: each layer
	is a stacking context, so a surface's own z-index (shadcn's `z-50`) only
	ranks it against its layer-mates.

	The containers are rendered from `core/ui/layers.ts`, the same list that tells
	components which layer to target, so a layer cannot exist as a portal target
	with no container to land in (or the reverse). Four of them stay empty here
	for exactly that reason: they are PORTAL TARGETS, addressed by id from the
	dialog, drawer, popover and select contents (`lib/shadcn/ui/*/*-content.svelte`).
	A component that forgets to name its target does not land here, and then its
	paint order is an accident of where it sits in the tree.

	The rest hold the app's own surfaces, supplied below as snippets keyed by layer
	name. Written as snippets rather than as hand-placed divs so that the list
	stays the only place a layer is declared: a surface whose layer was deleted
	simply never renders, instead of quietly painting in the root stacking context
	above everything.
-->
{#snippet noticeLayer()}
	<VersionAndInstallNotfications {serviceWorker} />
{/snippet}

{#snippet toastLayer()}
	<Notifications {notifications} />
{/snippet}

{#snippet progressLayer()}
	<NavigationProgress isNavigating={() => !!navigating.to} />
{/snippet}

{#each LAYERS as layer (layer.id)}
	<div id={layer.id} data-layer={layer.name}>
		{#if layer.name === 'notice'}{@render noticeLayer()}{:else if layer.name === 'toast'}{@render toastLayer()}{:else if layer.name === 'progress'}{@render progressLayer()}{/if}
	</div>
{/each}
