---
order: 3
---

# Search

Press <kbd>Ctrl</kbd> <kbd>K</kbd> (or <kbd>Cmd</kbd> <kbd>K</kbd>) anywhere to open the command palette, and type.

## In a build

`pnpm build` runs Pagefind over the prerendered HTML once SvelteKit has written it. Only the article of each page is indexed: the header, the sidebar and the footer are left out.

## Under the dev server

There is no built HTML under `vite dev`, so the dev server builds an index in memory from the same rendered pages and serves it where the build would put it. Results update after an edit.
