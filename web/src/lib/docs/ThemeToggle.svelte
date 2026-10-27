<script lang="ts">
	import {Button} from '$lib/shadcn/ui/button';
	import {toggleMode} from 'mode-watcher';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
</script>

<!-- Follows the system until pressed; mode-watcher remembers the choice. -->
<Button
	variant="ghost"
	size="icon"
	onclick={toggleMode}
	aria-label="Toggle dark mode"
	data-testid="theme-toggle"
>
	<SunIcon
		class="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
	/>
	<MoonIcon
		class="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
	/>
</Button>
