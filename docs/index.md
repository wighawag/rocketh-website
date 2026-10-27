---
layout: home

hero:
  name: Docs Template
  text: A documentation site from a folder of Markdown
  tagline: Plain Markdown in, a fast static site out, with search, navigation and dark mode.
  image:
    src: /logo.svg
    alt: Docs Template logo
  actions:
    - theme: brand
      text: Get started
      link: /guide/
    - theme: alt
      text: Reference
      link: /reference/
    - theme: alt
      text: GitHub
      link: https://github.com/wighawag/template-svelte-docs

features:
  - title: Plain Markdown
    details: Pages read well on GitHub too. Prose is never compiled as code, so a brace is just a brace.
    link: /guide/writing/
  - title: Navigation from the folder tree
    details: Sidebars ordered by frontmatter, or spelled out in a nav file when a section wants control.
    link: /reference/navigation/
  - title: Search everywhere
    details: Pagefind indexes the built site, and the dev server serves the same index from memory.
    link: /guide/search/
---

This page is `docs/index.md`. Its `layout: home` frontmatter draws the hero and the cards above, and anything written below the frontmatter, like this paragraph, is rendered under them.
