# rocketh-website

The site of [rocketh.dev](https://rocketh.dev), the documentation of [rocketh](https://github.com/wighawag/rocketh) and hardhat-deploy.

This repository holds the SITE only. The content (the Markdown pages, the logos and social cards) lives in the rocketh repository, next to the code it documents: `index.md`, `documentation/`, `hardhat-deploy/` and `public/` at its root, and the playground widget is built from its `packages/rocketh-playground`. A change to a page is a pull request on rocketh, not here.

It is made from [template-svelte-docs](https://github.com/wighawag/template-svelte-docs), tracked as the `stem` remote: an improvement that is not specific to rocketh.dev goes to the template first and comes down from there.

## How it is built and deployed

rocketh.dev is GitHub Pages of the rocketh repository. Its `.github/workflows/deploy.yml` checks out rocketh and this repository side by side, at a commit of this repository it pins, builds the playground in the rocketh workspace, builds this site against that checkout, and publishes `web/build`. So:

- a change to rocketh's content is live on the next push to rocketh's `main`;
- a change here is live once rocketh's workflow is pointed at the new commit of this repository, in a rocketh pull request that says what it was verified against.

## Working on it

Clone both repositories side by side, which is the default layout:

```bash
git clone https://github.com/wighawag/rocketh
git clone https://github.com/wighawag/rocketh-website
cd rocketh && pnpm i && pnpm docs:widgets   # the playground, built from rocketh
cd ../rocketh-website && pnpm i
pnpm web:dev        # dev server, with hot reload and search
pnpm build          # static site in web/build/
pnpm serve          # serve the build
```

From rocketh, `pnpm docs:dev`, `pnpm docs:build` and `pnpm docs:preview` do the same for a rocketh checkout (see its CONTRIBUTING.md), which is the usual way to preview a content change.

Another rocketh checkout (a worktree, a branch) is one variable, resolved against the current directory:

```bash
ROCKETH_DIR=~/dev/worktrees/rocketh/my-branch pnpm build
```

From `web/`: `pnpm check`, `pnpm test`, `pnpm format:check`, and `pnpm test:e2e` (builds, then drives the built site against the rocketh content, the playground included).

## What is specific to this site

| Where                                | What                                                                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/docs.config.js`                 | Where the rocketh checkout is (`ROCKETH_DIR`, else `../rocketh`), which of its files are pages, the two sections, the one redirect that is not the content's, the edit and GitHub links. |
| `web/src/web-config.json`            | The site's name, description and canonical URL.                                                                                                            |
| `web/vite.plugins.ts`                | `@rocketh/playground` resolved to the build in the rocketh checkout, never to an npm release.                                                              |
| `web/src/lib/embeds/index.ts`        | `<rocketh-playground>`, registered as a custom element.                                                                                                    |
| `web/e2e/tests/rocketh.e2e.ts`       | The site's end-to-end suite: every address the previous site served (a page, or a forwarding page that lands on one), the sidebar as the content declares it, code groups, containers, search, the playground, the theme, small screens. |
| `web/static/icon.png`                | The icon, from rocketh's `public/icon.png`.                                                                                                                |
| `.offshoot-omissions`                | What this repository drops from the template (its sample content, sample embeds and their suite), and why.                                                 |

The sidebar order is the content's: a `_sidebar.yaml` in each section folder of rocketh.

## Old addresses

Every page the previous VitePress site served still answers at its address: as the page, or as a forwarding page to where it moved. When rocketh moves a page, the redirect goes in rocketh's `_redirects.yaml` (the template's `redirectsFile`), in the same commit as the move, so no state of rocketh's `main` has a page without its old address or a redirect without its page. `redirects` in `web/docs.config.js` holds only what is not about the content: `/introduction/`, where VitePress published the repository README, forwards to that README on GitHub. See "Redirects" in the template's README for the format, anchors included.

The end-to-end suite (`web/e2e/tests/rocketh.e2e.ts`) checks every one of those addresses, and reads the sidebars and the redirects from the rocketh checkout rather than restating them, so it passes against rocketh's `main` across a restructure of its pages.

## The engine

How pages are written (frontmatter, containers, code groups, links), the navigation, search, embeds, redirects and link checking are the template's, and documented in [its README](https://github.com/wighawag/template-svelte-docs#readme). This file is site-specific on purpose: when the template's README changes, a merge from `stem` keeps this one.
