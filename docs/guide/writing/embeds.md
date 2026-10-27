---
title: Embeds
order: 1
---

# Embeds

A page can host something interactive without containing any Svelte. The site keeps a registry (`web/src/lib/embeds/index.ts`) of what may be embedded, and the page names it.

## A Svelte component by directive

```md
::component{name=Counter start=3}
```

::component{name=Counter start=3}

## A Svelte component by tag

```html
<docs-counter start="10" label="By tag"></docs-counter>
```

<docs-counter start="10" label="By tag"></docs-counter>

## A custom element

A web component is plain HTML in the page. The registry only says which script defines it, so that script is loaded on the pages that use it.

```html
<hello-element name="reader"></hello-element>
```

<hello-element name="reader"></hello-element>
