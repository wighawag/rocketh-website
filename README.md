# template-svelte-docs

A SvelteKit template for documentation sites: it renders a folder of plain Markdown files as a static, prerendered site with a sidebar per section, an on-this-page table of contents, search, previous/next links, a home page, an optional articles section with a feed, and a light and a dark theme. It is painted with the shadcn-svelte kit it inherits from `template-svelte-shadcn`.

The content in `docs/` is sample content that exercises every feature. Replace it with yours.

## Where this sits

```
template-svelte                    plain scoped CSS, no tailwind
 └─ template-svelte-tailwind       CSS replaced with tailwind
     ├─ template-svelte-tailwind-blog
     └─ template-svelte-shadcn     tailwind + shadcn kit
         └─ template-svelte-docs   <- you are here: Markdown docs sites
```

The blog template has its own Markdown support (mdsvex, posts compiled as Svelte). This one deliberately does not share it: here a page is plain Markdown that is never compiled as Svelte, rendered by a unified (remark/rehype) pipeline.

## Quick start

```bash
pnpm install
pnpm web:dev        # dev server, with hot reload and search
pnpm build          # static site in web/build/, search index included
pnpm serve          # serve the build
```

From `web/`: `pnpm check`, `pnpm test`, `pnpm format:check`, and `pnpm test:e2e` (builds, then drives the built site with Playwright).

## Pointing the site at your content

Everything about the content is in `web/docs.config.js`. Every field is optional:

| Field        | Default           | Meaning                                                                                                    |
| ------------ | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `contentDir` | `../docs`         | The Markdown folder, relative to the config file. It can be anywhere on disk.                              |
| `include`    | `['**/*.md']`     | Globs of the pages, relative to `contentDir`.                                                              |
| `exclude`    | `[]`              | Globs to leave out. `node_modules`, dot folders and `publicDir` are always left out.                       |
| `base`       | `/`               | Where the content is mounted in the site. `/docs/` puts `guide/intro.md` at `/docs/guide/intro/`.          |
| `publicDir`  | `public`          | A folder of `contentDir` served as-is at `base` (logos, images), like VitePress's `public`.                 |
| `sections`   | every folder      | The header nav, in order: `[{dir, label}]`. Each top-level folder is a section with its own sidebar.      |
| `articles`   | none              | The top-level folder of dated articles. It gets a list page and an RSS feed at `/feed.xml`.               |
| `editLink`   | none              | `{repo, branch, dir, text}`: "edit this page" links to `<repo>/edit/<branch>/<dir>/<file>`.               |
| `codeThemes` | GitHub light/dark | The two Shiki themes.                                                                                      |
| `navFile`    | `_sidebar.yaml`   | The file name of a section's explicit sidebar.                                                             |

The site's name, description and canonical URL (used by the feed and the social cards) are in `web/src/web-config.json`.

Content that lives elsewhere is one setting. The docs at the root of another repository, with other Markdown around them:

```js
export default {
	contentDir: '../../my-project',
	include: ['index.md', 'documentation/**/*.md', 'guides/**/*.md'],
	sections: [
		{dir: 'documentation', label: 'Documentation'},
		{dir: 'guides', label: 'Guides'},
	],
};
```

A sibling package in a monorepo is the same: `contentDir: '../../packages/docs'`. The dev server is allowed to read the folder and watches it. To build once against other content without editing the file, set `DOCS_CONFIG`:

```bash
DOCS_CONFIG=/path/to/other.config.js pnpm build
```

## Writing pages

A page is a Markdown file; its path is its address. `guide/install.md` is `/guide/install/`, and `guide/index.md` (or a `README.md` when there is no `index.md`) is `/guide/`. Pages read well on GitHub too.

- **GitHub Flavored Markdown**: tables, task lists, strikethrough, autolinks, footnotes.
- **Containers**, VitePress style: `::: tip`, `::: info`, `::: note`, `::: important`, `::: warning`, `::: caution`, `::: danger`, and `::: details`, each with an optional title (`::: warning Read this first`). Both the spaced form (blank lines around the markers) and the compact form (opening line, body and `:::` in one paragraph) work. GitHub's `> [!NOTE]` alerts render the same way.
- **Code groups**: `::: code-group` around consecutive fences labelled like ` ```bash [npm] `, shown as tabs.
- **Code**: highlighted by Shiki in a light and a dark theme, with a copy button. A `[label]` after the language names a lone block too.
- **Anchors**: `## Title {#custom-id}` sets a heading's id; other headings get GitHub-style slugs, so an `#anchor` works the same on GitHub and on the site.
- **Links**: site-absolute (`/guide/install/`, relative to the content root), relative (`../install/`, resolved against the file, as on GitHub), or to the Markdown file itself (`install.md#usage`). They are written into the page relative to it, so the build works under any base path and on IPFS.
- **Images**: one next to the page (`![](./diagram.svg)`) is bundled by Vite; one in `publicDir` is linked as `/logo.svg`.
- **Prose is never compiled as code**: `{` and `:` in text are just characters.

### Frontmatter

| Field          | Meaning                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `title`        | The page title. Defaults to the first `#` heading (Markdown or HTML), then to a home page's `hero.name`, then the file name. |
| `description`  | For search engines, previews and the article list. Defaults to the first paragraph.                                  |
| `order`        | Position in a generated sidebar, lowest first. **Pages without `order` come after those with one, alphabetically by title.** |
| `sidebarTitle` | A shorter label for the sidebar and the previous/next links.                                                         |
| `layout`       | `doc` (default), `home`, `page` (no sidebar, no table of contents), `article` (default in the articles folder).       |
| `toc`          | `false` hides the on-this-page column.                                                                               |
| `editLink`     | `false` hides the edit link.                                                                                         |
| `image`        | The page's social card (`og:image`), as a path like `/cards/page.png`.                                               |
| `date`         | `YYYY-MM-DD`: an article's date, for the list and the feed.                                                          |
| `draft`        | `true` keeps the page out of a build; the dev server still shows it.                                                 |
| `hero`         | `layout: home`: `name`, `text`, `tagline`, `image` (`src`, or `light` and `dark`, plus `alt`), `actions` (`theme: brand` or `alt`, `text`, `link`). |
| `features`     | `layout: home`: cards with `title`, `details`, and optional `icon` and `link`.                                       |

The home page fields follow VitePress's `layout: home` shape, so a VitePress home page carries over as it is. Any page can be a home page: a section's `index.md` with `layout: home` makes a landing page for that section.

### Raw HTML, and why it is allowed

HTML in a page is rendered as written. That is how a custom element gets into a page, and it is not sanitised. **The assumption is that the content is trusted: written by the site's authors and reviewed like the source code, because it is compiled into the site like the source code.** Nothing here renders Markdown from users at runtime. A descendant that builds pages from content it does not control (contributions merged without review, content fetched from elsewhere) must add `rehype-sanitize` to the pipeline in `web/docs-engine/markdown/render.ts`, and accept that embeds and custom elements then need an allow-list.

## Navigation

- **Sidebar**: each section's sidebar is generated from its folder. The section's `index.md` comes first. A page is an entry; a sub-folder with an `index.md` is an entry whose children are the pages inside it; a sub-folder without one is a group labelled from its name. Entries are sorted by `order`, then by title.
- **Nav file**: a section that wants explicit control puts a `_sidebar.yaml` in its folder. It has VitePress's sidebar shape (`text`, `link`, `items`, `collapsed`), and a `link` may be site-absolute, relative to the section folder, or a Markdown file name. A link that resolves to nothing fails the build.
- **Previous/next** follow the sidebar's reading order. The **breadcrumb** follows the sidebar's groups. The **table of contents** lists the h2 and h3 headings and highlights the one being read. The **edit link** comes from `editLink`. Unknown addresses get a **404 page** (the static host serves `404.html`, see `web/static/_redirects`).

## Articles

With `articles: 'articles'`, every page in `docs/articles/` other than its `index.md` is an article: it has its own layout and is listed newest first by its `date` frontmatter at `/articles/` (under that folder's `index.md`, if it has one). Articles with a `date` are also in the RSS feed at `/feed.xml`; give every article one. Absolute URLs in the feed come from `canonicalURL` in `web/src/web-config.json`.

## Embeds

A page can host something interactive without containing Svelte. `web/src/lib/embeds/index.ts` is the registry of what may be embedded:

```ts
export const embeds: EmbedRegistry = {
	// A Svelte component, by directive name, and by tag when `tag` is set.
	Counter: {component: () => import('./Counter.svelte'), tag: 'docs-counter'},
	// A custom element: pages use its tag, the site loads its script.
	'hello-element': {element: () => import('./hello-element'), tag: 'hello-element'},
};
```

A page then uses it in one of three ways:

```md
::component{name=Counter start=3}

<docs-counter start="3"></docs-counter>

<hello-element name="reader"></hello-element>
```

- `::component{name=X ...}` mounts the registered Svelte component `X` there. The other attributes are its props, read as numbers, booleans or JSON when they look like one (`start=3` is the number 3). The container form `:::component{name=X}` ... `:::` keeps its Markdown body as the content shown before the component mounts.
- A registered `tag` mounts the component into every such element, with the element's attributes as props (`data-*` and `class` excluded; `kebab-case` becomes `camelCase`).
- An `element` entry does not mount anything: the page holds a real custom element, and the registry only says which script defines it. That script is imported on the pages that contain the tag, and the browser upgrades the element.

Embeds are mounted on the client, after the page has loaded; what is between the tags is shown until then. Every loader is a dynamic import, so only the pages that use an embed download it. An unknown name is a console warning, not a build error.

## Search

Search is [Pagefind](https://pagefind.app), opened with Ctrl K (Cmd K on macOS) as a command palette built from the shadcn `Command` component.

- **Build**: `pnpm build` runs `web/docs-engine/postbuild.js` after `vite build`. It copies the content's public folder into the build, then indexes the prerendered HTML into `build/pagefind/`. Only the `data-pagefind-body` part of each page (its article) is indexed; header, sidebar and footer are left out.
- **Dev**: there is no built HTML under `vite dev`, so the dev server builds a Pagefind index in memory from the same rendered pages, through Pagefind's Node API, and serves it at `/pagefind/`. Search works the same way in dev as in the build, and an edit invalidates the index, which is rebuilt on the next search. The two can differ only in what counts as "the article": dev indexes the rendered Markdown, the build indexes what the layout wrapped in `data-pagefind-body`.

## Link checking

A dead link fails the build, twice over:

- The docs engine resolves every link and every `#anchor` while it renders, and reports the file and line of each problem. Under `vite dev` these are warnings, and `vite build` stops on them.
- SvelteKit's prerender crawl follows every link of the built pages, including those components render, and fails on a page that does not exist (`handleHttpError`) or an anchor that is not on its page (`handleMissingId`). See `prerender` in `web/svelte.config.js`.

## How it works

| Where                         | What                                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/docs-engine/`            | Node side: the config (`config.js`), the Markdown pipeline (`markdown/`), the site model (`site.ts`), sidebars (`sidebar.ts`), the Vite plugin, the post-build step. |
| `web/src/lib/core/docs/`      | Browser side, framework-free `.ts`: navigation, table of contents, search, embeds and page enhancement, the feed, the shared types.                                   |
| `web/src/lib/docs/`           | The Svelte components: header, sidebar, table of contents, page layouts, search dialog. They import the shadcn kit directly, as app code may.                       |
| `web/src/lib/embeds/`         | The embed registry and the sample embeds.                                                                                                                            |
| `web/src/routes/[...path]/`   | The one route that renders every page. `feed.xml/` is the feed.                                                                                                      |

The pipeline: YAML frontmatter, a line-level pass that rewrites `:::` containers into remark-directive syntax (this is what makes the compact form work), then unified with remark-parse, remark-gfm and remark-directive, the engine's own transforms (containers, embeds, heading ids), remark-rehype, rehype-raw, Shiki, the engine's HTML transforms (code blocks, code groups, links) and rehype-stringify.

Each `.md` file becomes a module:

```ts
export const html: string; // the rendered body
export const frontmatter: Record<string, unknown>;
export const title: string;
export const hasH1: boolean; // the body has its own h1
export const headings: {depth: 2 | 3; id: string; text: string}[];
export const order: number | null;
export const route: string; // e.g. '/guide/install/'
export default {html, frontmatter, title, hasH1, headings, order, route};
```

`virtual:docs` exports `manifest` (every page's metadata, the sections with their sidebars, the articles route, the edit link pattern) and `loaders` (a dynamic import per page). Under `vite dev` an edit to a page's body is swapped in place without a reload; an edit that changes the manifest (a title, an order, a page added or removed) reloads the page.

## For descendants of this template

A site made from this template changes, in the normal case, only these:

- `web/docs.config.js` and `web/src/web-config.json`: where the content is and what the site is called.
- `web/src/lib/embeds/`: its own widgets and custom elements (and remove the samples).
- `web/src/app.css` tokens: its palette. The docs styles at the bottom use the tokens, so they follow.
- `web/static/`: icons, `_redirects`.

The engine (`web/docs-engine/`), `web/src/lib/core/docs/` and the components in `web/src/lib/docs/` are generic. An improvement to them that is not specific to one site belongs here, so that every site made from this template gets it.

## Inherited from `template-svelte-shadcn`

- `web/src/lib/shadcn/`: the vendored shadcn-svelte kit. This template added `breadcrumb`, `command`, `input-group`, `kbd`, `sheet` and `textarea`. Add more with:

  ```bash
  cd web
  npx shadcn-svelte@latest add <component>
  ```

- The `$ui` alias, through which `core/` reaches the kit (see `web/src/lib/core/ui/README.md`), and the theme tokens in `web/src/app.css`.
