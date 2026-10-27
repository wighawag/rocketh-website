# Configuration

`web/docs.config.js` holds the content settings; `web/src/web-config.json` holds the site's name, description and canonical URL.

| Field        | Default            | Meaning                                                                   |
| ------------ | ------------------ | ------------------------------------------------------------------------- |
| `contentDir` | `../docs`          | The Markdown folder, relative to the config file. May be outside `web/`.  |
| `include`    | `['**/*.md']`      | Globs of the pages, relative to `contentDir`.                             |
| `exclude`    | `[]`               | Globs to leave out, besides `node_modules`, dot folders and `publicDir`.  |
| `base`       | `/`                | Where the content is mounted in the site.                                 |
| `publicDir`  | `public`           | A folder of `contentDir` served as-is at `base`.                          |
| `sections`   | every folder       | The header nav: `{dir, label}` in order.                                  |
| `articles`   | none               | The folder of dated articles, with a list page and `/feed.xml`.           |
| `editLink`   | none               | `{repo, branch, dir, text}` for the "edit this page" link.                |
| `codeThemes` | GitHub light/dark  | The two Shiki themes.                                                     |
| `navFile`    | `_sidebar.yaml`    | The file name of a section's explicit sidebar.                            |
| `socialLinks` | none              | `[{icon: 'github', link}]`: links at the right of the header.             |
| `redirects`  | none               | `{'/old/path/': '/new/path/'}`: old addresses forwarded to their new page. |
| `redirectsFile` | `_redirects.yaml` | A YAML file of `contentDir` with more redirects, read when it exists.  |

Set `DOCS_CONFIG=path/to/other.config.js` to build with another config file without editing this one.
