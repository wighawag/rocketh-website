---
title: Writing pages
order: 2
---

# Writing pages

Everything on this page is plain Markdown, plus the few extensions VitePress made common. A page reads well on GitHub as well as on the site.

## Containers

Separated by blank lines:

::: tip
A tip, with **Markdown** inside.
:::

::: info Custom title
An info box with its own title.
:::

Or compact, with the opening line, the body and the closing marker in one paragraph:

::: warning
Compact containers work too.
:::
::: danger Careful
And this one has a title.
:::

GitHub's alert syntax renders the same way:

> [!NOTE]
> A note, written the way GitHub renders it.

::: details Click to expand
Hidden until opened.
:::

## Code groups

::: code-group

```ts [counter.ts]
export function increment(count: number): number {
	return count + 1;
}
```

```js [counter.js]
export function increment(count) {
	return count + 1;
}
```

:::

## Custom anchors {#custom-anchors}

A heading written `## Custom anchors {#custom-anchors}` keeps that id whatever its text says. Without the suffix, a heading gets a slug like GitHub's: this section links to [the tables below](#tables-and-task-lists).

## Tables and task lists

| Feature    | Syntax                 | Since |
| ---------- | ---------------------- | ----- |
| Containers | `::: tip`              | 1.0   |
| Code group | `::: code-group`       | 1.0   |
| Anchors    | `## Title {#id}`       | 1.0   |

- [x] Write the page
- [ ] Review it

## Images

An image next to the page is bundled with it:

![A diagram](./diagram.svg)

One in the public folder is served as-is: ![Logo](/logo.svg)

## Links

Link to a page by its path, [`/guide/search/`](/guide/search/), relative to this one, [`../faq/`](../faq/), or by its file, [`embeds.md`](./embeds.md). All three are checked when the site is built.
