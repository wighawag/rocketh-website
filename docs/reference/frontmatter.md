# Frontmatter

Every field is optional.

| Field          | Type                                     | Meaning                                                                                       |
| -------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `title`        | string                                   | The page title. Defaults to the first `#` heading, then to the file name.                     |
| `description`  | string                                   | For search engines, link previews and the article list. Defaults to the first paragraph.      |
| `order`        | number                                   | Position in a generated sidebar, lowest first. Pages without one follow, alphabetically.      |
| `sidebarTitle` | string                                   | A shorter label for the sidebar and the previous/next links.                                  |
| `layout`       | `doc`, `home`, `page`, `article`         | `doc` by default (`article` inside the articles folder). `page` drops the sidebar and the TOC. |
| `image`        | path                                     | The page's social card (`og:image`), e.g. `/cards/guide.png` from the public folder.           |
| `toc`          | boolean                                  | `false` hides the on-this-page column.                                                        |
| `editLink`     | boolean                                  | `false` hides the edit link.                                                                  |
| `date`         | `YYYY-MM-DD`                             | An article's date, used to sort the list and the feed.                                        |
| `draft`        | boolean                                  | `true` keeps the page out of a build; the dev server still shows it.                          |
| `hero`         | object                                   | `layout: home` only: `name`, `text`, `tagline`, `image`, `actions`.                           |
| `features`     | list                                     | `layout: home` only: cards with `title`, `details`, optional `icon` and `link`.               |

## Home page {#home}

```yaml
layout: home
hero:
  name: Project
  text: What it is, in a line
  tagline: Why it matters, in a sentence.
  image: {src: /logo.svg, alt: Project logo}
  actions:
    - {theme: brand, text: Get started, link: /guide/}
    - {theme: alt, text: GitHub, link: https://github.com/owner/repo}
features:
  - {title: Fast, details: Prerendered, link: /guide/}
```
