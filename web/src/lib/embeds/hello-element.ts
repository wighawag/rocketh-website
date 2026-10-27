/**
 * A plain custom element, standing in for a widget a site ships as a web
 * component (an interactive playground, a chart). Nothing about it knows
 * Svelte: the page contains `<hello-element name="reader">`, and the embed
 * registry loads this file on the pages that do.
 */
class HelloElement extends HTMLElement {
	static observedAttributes = ['name'];

	constructor() {
		super();
		this.attachShadow({mode: 'open'});
	}

	connectedCallback() {
		this.render();
	}

	attributeChangedCallback() {
		this.render();
	}

	private render() {
		const name = this.getAttribute('name') ?? 'world';
		this.shadowRoot!.innerHTML = `<style>
	p { margin: 0; padding: 0.75rem 1rem; border: 1px dashed currentColor; border-radius: 0.5rem; }
</style><p part="text">Hello, <strong></strong>! (a custom element)</p>`;
		this.shadowRoot!.querySelector('strong')!.textContent = name;
	}
}

if (!customElements.get('hello-element')) {
	customElements.define('hello-element', HelloElement);
}

export {};
