<script lang="ts">
	import Notifications from '$lib/core/notifications/Notifications.svelte';
	import NotificationOverlay from '$lib/core/notifications/NotificationOverlay.svelte';
	import VersionAndInstallNotfications from '$lib/core/service-worker/VersionAndInstallNotfications.svelte';
	import NavigationProgress from '$lib/components/NavigationProgress.svelte';
	import SiteHeader from '$lib/docs/SiteHeader.svelte';
	import SearchDialog from '$lib/docs/SearchDialog.svelte';
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

<NavigationProgress isNavigating={() => !!navigating.to} />

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

<NotificationOverlay>
	<Notifications {notifications} />
</NotificationOverlay>

<VersionAndInstallNotfications {serviceWorker} />
