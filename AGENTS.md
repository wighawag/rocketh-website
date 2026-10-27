# setup

`pnpm i`

# frontend

in ./web
for typescript checks: `pnpm check`
for tests: `pnpm test`
for formatting: `pnpm format:check` (`pnpm format` to fix)
for the build: `pnpm build` (vite build, then `docs-engine/postbuild.js`: public folder and search index)
for end-to-end tests: `pnpm test:e2e` (builds first, then drives the built site)

## Svelte conventions

- **`.svelte` files must be logic-less or logic-minimal.** They should only render UI and wire props/stores together. Small presentational conveniences are fine (a display formatter, a class toggle, a UI-only animation, local open/closed modal state). Anything else, business/domain logic, async calls, data fetching/derivation, non-trivial computation, filtering/sorting/aggregating domain data, network error handling, belongs in a plain `.ts` module (a helper, a store, or a service) that the component imports.

- **Never create `.svelte.ts` files.** Do not use Svelte runes (`$state`, `$derived`, `$effect`, ...) outside of `.svelte` components. Put reusable logic in plain `.ts` files and expose reactivity with Svelte stores (`writable`/`readable`/`derived` from `svelte/store`). Components consume those stores with the `$store` syntax and own any `$effect`/lifecycle wiring themselves.

- Logic lives in `.ts`, reactivity crosses the boundary as stores. Prefer factory functions that return `{subscribe, ...actions}`.

The second of these is checked by `web/test/svelte-conventions-boundary.test.ts`, along with the `.svelte.ts` ban. The first is deliberately left to review: it is about the KIND of code, not its size, and every mechanical proxy for it fires on the wrong things.

## The framework boundary

- **Only `web/src/lib/kit` may import `$app/*`.** Everything under `web/src/lib/core` takes what it needs from the framework as a parameter (`PathResolver`, `ServiceWorkerEnvironment`), and `web/src/routes/**` is exempt because routes are the framework's own surface. `web/test/framework-boundary.test.ts` enforces this, and `web/src/lib/kit/README.md` explains the scope, including what the rule deliberately does not cover.

- **`web/src/lib/index.ts` is where the app is composed**, which is why it is allowed to import both `./kit/*` and the framework. Anything that composes THIS app belongs there rather than in `core/`.

## The docs engine

This template renders a folder of Markdown (`docs/` by default, set in `web/docs.config.js`) as the site. README.md documents it for users; these are the rules for changing it.

- **Three layers, kept apart.** `web/docs-engine/` is Node code that runs inside Vite (config, Markdown pipeline, site model, Vite plugin, post-build). `web/src/lib/core/docs/` is framework-free browser `.ts` (navigation, table of contents, search, embeds, feed, types). `web/src/lib/docs/` holds the Svelte components, which render what `core/docs` computes. Do not import `docs-engine` from `src/`, except `src/lib/core/docs/types.ts` and `props.ts`, which both sides share and which must stay free of runtime dependencies.
- **Content is never compiled as Svelte.** A page is an HTML string rendered with `{@html}`. Do not add a path that feeds Markdown to the Svelte compiler: that is what makes `{` in prose safe.
- **Content is trusted.** Raw HTML is rendered unsanitised, on the stated assumption (README, "Raw HTML") that the content is reviewed like code. A change that renders content from elsewhere must add sanitising in the same change.
- **Embeds go through the registry** (`web/src/lib/embeds/index.ts`), never through Svelte in Markdown.
- **Links must keep failing the build when they are dead.** The engine reports them with file and line (`DocsSite.check()`), and the prerender crawl in `svelte.config.js` is the second net. Do not loosen either to get a build through: fix the content.
- **Test the engine without Vite.** `DocsSite` and the Markdown functions take plain values; their tests are in `web/test/docs-engine/`, and the end-to-end suite is `web/e2e/tests/docs.e2e.ts`.
- **Dev servers**: `pnpm web:dev` serves search from an in-memory index. Stop what you start.

## For descendants of this template

This repo is the root of a template tree; other repos derive from it through a `stem` git remote and inherit `web/src/lib/core` wholesale, in several cases byte-identical. A change that is meaningful for a sibling belongs HERE rather than in the descendant that discovered it, or every sibling silently misses it. The two boundary tests above are stated at this level for the same reason: a rule inherited by every descendant is worth more than the same rule re-derived in each of them.

A docs site made from this template should normally change only `web/docs.config.js`, `web/src/web-config.json`, `web/src/lib/embeds/`, the theme tokens in `web/src/app.css` and `web/static/`, plus its content. A fix or feature in the docs engine, `core/docs` or the docs components that is not specific to that site belongs here.
