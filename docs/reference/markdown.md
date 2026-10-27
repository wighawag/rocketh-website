# Markdown syntax

The pipeline is unified: remark-parse with remark-gfm (tables, task lists, strikethrough, autolinks, footnotes) and remark-directive, then rehype with Shiki for code.

## Containers

| Syntax                         | Renders as                 |
| ------------------------------ | -------------------------- |
| `::: tip` ... `:::`            | a tip                      |
| `::: warning Custom title`     | a warning with that title  |
| `::: details Title`            | a collapsible block        |
| `> [!NOTE]`                    | a note, as GitHub does it  |

The kinds are `tip`, `info`, `note`, `important`, `warning`, `caution`, `danger` and `details`.

## Code

A fence's language picks the highlighting, and `[label]` names the block: it is the tab of a code group, and the label shown on a lone block.

## Footnotes

Footnotes work as on GitHub.[^1]

[^1]: Like this one.

## Raw HTML

HTML in a page is rendered as written, which is how a custom element gets in. The content is trusted: see the README.
