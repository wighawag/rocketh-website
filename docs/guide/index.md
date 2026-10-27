# Introduction

This template turns a folder of Markdown into a documentation site: a static, prerendered SvelteKit site with a sidebar per section, an on-this-page table of contents, search, and a light and a dark theme.

The page you are reading is `docs/guide/index.md`. Being the `index.md` of the `guide` folder makes it the first page of the **Guide** section, at `/guide/`.

## What you write

Markdown, with the extensions a documentation site needs:

- [containers](./writing/index.md#containers) for tips and warnings,
- [code groups](./writing/index.md#code-groups) for the same command in several package managers,
- [custom anchors](./writing/index.md#custom-anchors) that survive a heading being reworded,
- and [embeds](./writing/embeds.md) for the rare page that needs something interactive.

## What you get

A site that is checked as it is built: a link to a page that does not exist, or to an `#anchor` that is not on its page, fails the build. Start with [Getting started](./getting-started.md).
