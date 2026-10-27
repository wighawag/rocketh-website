# Navigation

## Generated sidebars

A section's sidebar is built from its folder:

- the section's `index.md` comes first;
- every other page is an entry, and a sub-folder with an `index.md` is an entry whose children are the pages inside it;
- entries are sorted by `order` frontmatter, lowest first, and **pages without an `order` come after, alphabetically by title**.

## Nav files

A section with a `_sidebar.yaml` uses it instead. This section has one:

```yaml
- text: Overview
  link: index.md
- text: Content
  collapsed: false
  items:
    - text: Frontmatter
      link: frontmatter.md
```

`collapsed: true` starts a group closed; it opens anyway on a page inside it. A link that does not resolve to a page fails the build.

## Previous and next

The links at the bottom of a page follow the sidebar's reading order.
