import {mount, unmount, type Component} from 'svelte';
import {coerceProp} from './props.js';

/**
 * What can be embedded in a page, by name.
 *
 * - `component`: a Svelte component, mounted where the page says
 *   `::component{name=Counter start=3}`, and also into every `<tag>` element
 *   when `tag` is set (`<docs-counter start="3"></docs-counter>`). Props come
 *   from the directive's attributes or the tag's, read as numbers, booleans or
 *   JSON when they look like one.
 * - `element`: a custom element the page uses as a plain HTML tag. `load`
 *   imports the script that defines it, only on pages that contain `tag`.
 *
 * Loaders are dynamic imports, so a widget's code is fetched only by the
 * pages that use it.
 */
export type EmbedEntry =
	| {
			component: () => Promise<{default: Component<any>}>;
			tag?: string;
	  }
	| {element: () => Promise<unknown>; tag: string};

export type EmbedRegistry = Record<string, EmbedEntry>;

function propsFromAttributes(element: Element): Record<string, unknown> {
	const props: Record<string, unknown> = {};
	for (const attribute of Array.from(element.attributes)) {
		// `data-*` and `class` style the host; they are not props.
		if (attribute.name.startsWith('data-') || attribute.name === 'class')
			continue;
		const name = attribute.name.replace(/-([a-z])/g, (_, c: string) =>
			c.toUpperCase(),
		);
		props[name] = coerceProp(attribute.value);
	}
	return props;
}

function selectTab(button: HTMLElement): void {
	const group = button.closest('[data-code-group]');
	if (!group) return;
	const index = button.dataset.codeGroupTab;
	for (const tab of group.querySelectorAll<HTMLElement>(
		'[data-code-group-tab]',
	)) {
		const selected = tab.dataset.codeGroupTab === index;
		tab.setAttribute('aria-selected', String(selected));
		tab.tabIndex = selected ? 0 : -1;
	}
	for (const panel of group.querySelectorAll<HTMLElement>(
		'[data-code-group-panel]',
	)) {
		panel.hidden = panel.dataset.codeGroupPanel !== index;
	}
}

async function copyCode(button: HTMLElement): Promise<void> {
	const code = button.parentElement?.querySelector('pre')?.textContent ?? '';
	try {
		await navigator.clipboard.writeText(code);
		button.textContent = 'Copied';
		button.dataset.copied = '';
	} catch {
		button.textContent = 'Failed';
	}
	setTimeout(() => {
		button.textContent = 'Copy';
		delete button.dataset.copied;
	}, 1500);
}

/**
 * Bring a rendered page to life: copy buttons, code-group tabs, embeds.
 * Call it on the element holding the page's HTML; it returns the cleanup,
 * which unmounts every component it mounted.
 */
export function enhance(
	root: HTMLElement,
	registry: EmbedRegistry,
	onError: (message: string) => void = (m) => console.warn(m),
): () => void {
	let alive = true;
	const mounted: Record<string, any>[] = [];

	const onClick = (event: MouseEvent) => {
		const target = event.target as HTMLElement | null;
		const copy = target?.closest<HTMLElement>('[data-copy]');
		if (copy && root.contains(copy)) return void copyCode(copy);
		const tab = target?.closest<HTMLElement>('[data-code-group-tab]');
		if (tab && root.contains(tab)) selectTab(tab);
	};
	const onKeydown = (event: KeyboardEvent) => {
		const tab = (event.target as HTMLElement | null)?.closest<HTMLElement>(
			'[data-code-group-tab]',
		);
		if (!tab || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
		const tabs = Array.from(
			tab.parentElement?.querySelectorAll<HTMLElement>(
				'[data-code-group-tab]',
			) ?? [],
		);
		const at = tabs.indexOf(tab);
		const next =
			tabs[
				(at + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
			];
		selectTab(next);
		next.focus();
		event.preventDefault();
	};
	root.addEventListener('click', onClick);
	root.addEventListener('keydown', onKeydown);

	async function mountInto(
		target: Element,
		entry: Extract<EmbedEntry, {component: unknown}>,
		props: Record<string, unknown>,
	) {
		const {default: component} = await entry.component();
		if (!alive) return;
		target.replaceChildren();
		mounted.push(mount(component, {target, props}));
		target.setAttribute('data-embed-mounted', '');
	}

	for (const placeholder of root.querySelectorAll<HTMLElement>(
		'[data-embed]',
	)) {
		const name = placeholder.dataset.embed!;
		const entry = registry[name];
		if (!entry || !('component' in entry)) {
			onError(`docs: no component registered for embed "${name}"`);
			continue;
		}
		let props: Record<string, unknown> = {};
		try {
			props = JSON.parse(placeholder.dataset.props ?? '{}');
		} catch {
			onError(`docs: bad props for embed "${name}"`);
		}
		mountInto(placeholder, entry, props).catch((e) =>
			onError(`docs: embed "${name}" failed: ${e}`),
		);
	}

	for (const [name, entry] of Object.entries(registry)) {
		if (!entry.tag) continue;
		const elements = root.querySelectorAll(entry.tag);
		if (elements.length === 0) continue;
		if ('element' in entry) {
			entry
				.element()
				.catch((e) => onError(`docs: element <${entry.tag}> failed: ${e}`));
			continue;
		}
		for (const element of elements) {
			mountInto(element, entry, propsFromAttributes(element)).catch((e) =>
				onError(`docs: embed "${name}" failed: ${e}`),
			);
		}
	}

	return () => {
		alive = false;
		root.removeEventListener('click', onClick);
		root.removeEventListener('keydown', onKeydown);
		for (const instance of mounted) void unmount(instance);
	};
}
