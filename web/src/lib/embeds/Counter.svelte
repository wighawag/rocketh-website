<script lang="ts">
	import {Button} from '$lib/shadcn/ui/button';

	let {start = 0, label = 'Count'}: {start?: number; label?: string} = $props();
	// svelte-ignore state_referenced_locally
	let count = $state(start);
</script>

<div
	class="not-prose my-4 flex items-center gap-3 rounded-lg border p-4"
	data-testid="counter"
>
	<span class="text-sm text-muted-foreground">{label}</span>
	<output class="min-w-8 text-center font-mono text-lg" data-testid="count"
		>{count}</output
	>
	<Button variant="outline" size="sm" onclick={() => count++}>Increment</Button>
</div>
