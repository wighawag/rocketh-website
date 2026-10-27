---
title: Getting started
order: 1
description: Install the template, point it at your Markdown, and build.
---

# Getting started

## Install {#install}

::: code-group

```bash [pnpm]
pnpm install
```

```bash [npm]
npm install
```

```bash [yarn]
yarn install
```

:::

## Run it

```bash
pnpm web:dev
```

Then open the address the dev server prints. Edit any page under `docs/` and it updates in place.

::: tip
The dev server serves search too, from an index it builds in memory. See [Search](./search.md).
:::

## Point it at your content

Edit `web/docs.config.js`:

```js [web/docs.config.js]
export default {
	contentDir: '../docs',
	sections: [{dir: 'guide', label: 'Guide'}],
};
```

::: warning Paths are relative to the config file
`contentDir: '../docs'` is the `docs` folder next to `web/`, not inside it.
:::

## Build

```bash
pnpm build
```

The site lands in `web/build/`, ready for any static host.
