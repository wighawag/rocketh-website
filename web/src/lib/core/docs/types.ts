/**
 * The shapes the docs engine (`web/docs-engine`, which runs in Vite) hands to
 * the site (which runs in the browser). Both sides import this file, so it is
 * types only: nothing here may need a runtime.
 */

/** An h2 or h3 of a page, for the on-this-page table of contents. */
export type Heading = {depth: 2 | 3; id: string; text: string};

/** `layout` frontmatter: how a page is presented. */
export type Layout = 'doc' | 'home' | 'page' | 'article';

/**
 * What each Markdown file compiles to: the default export (and the named
 * exports) of the module the Vite plugin generates for a `.md` file.
 */
export type DocModule = {
	/** Site path, e.g. `/guide/install/`. */
	route: string;
	/** The rendered body. Trusted HTML: see "Raw HTML" in the README. */
	html: string;
	frontmatter: Record<string, unknown>;
	/** Frontmatter `title`, else the first `#` heading, else the file name. */
	title: string;
	/** True when the body has its own `#` heading, so the layout adds none. */
	hasH1: boolean;
	headings: Heading[];
	/** Frontmatter `order`, used to sort the generated sidebar. */
	order: number | null;
};

/** A page as listed in the manifest: everything but the body. */
export type PageMeta = {
	route: string;
	/** Path of the source file relative to the content directory. */
	source: string;
	title: string;
	/** Shorter label for the sidebar (`sidebarTitle` frontmatter). */
	sidebarTitle: string | null;
	order: number | null;
	/** Top-level folder the page lives in, if any. */
	section: string | null;
	layout: Layout;
	/** `date` frontmatter as `YYYY-MM-DD`, for articles. */
	date: string | null;
	/** `description` frontmatter, else the first paragraph. */
	description: string;
	/** `image` frontmatter: the page's social card, as a site path. */
	image: string | null;
	/** `toc: false` hides the on-this-page column. */
	toc: boolean;
	/** `editLink: false` hides the edit link. */
	editLink: boolean;
};

/** One sidebar entry: a link, a group of entries, or both. */
export type NavItem = {
	text: string;
	link?: string;
	items?: NavItem[];
	/** `true` starts the group closed (it still opens on the current page). */
	collapsed?: boolean;
};

export type Section = {
	dir: string;
	/** Site path of the section, e.g. `/guide/`. */
	route: string;
	label: string;
	/** Where the header nav points: the index page, else the first page. */
	link: string;
	sidebar: NavItem[];
	/** Shown in the header nav: listed in `sections`, or none are listed. */
	nav: boolean;
};

export type HeroAction = {
	theme?: 'brand' | 'alt';
	text: string;
	link: string;
};

export type Hero = {
	name?: string;
	text?: string;
	tagline?: string;
	image?: {src?: string; light?: string; dark?: string; alt?: string};
	actions?: HeroAction[];
};

export type Feature = {
	title: string;
	details?: string;
	icon?: string;
	link?: string;
	linkText?: string;
};

/** Everything the site needs to know about the content, minus page bodies. */
export type DocsManifest = {
	/** Where the content is mounted, `/` or `/docs/` style. */
	base: string;
	pages: PageMeta[];
	sections: Section[];
	/** Site path of the articles list, when the site has articles. */
	articles: string | null;
	editLink: {
		/** `{path}` is replaced by the page's `source`. */
		pattern: string;
		text: string;
	} | null;
	/**
	 * Old site paths, each forwarded to a new one: a site path (possibly with
	 * an `#anchor`) or an absolute URL. Keys are in `/x/` shape.
	 */
	redirects: Record<string, string>;
	/**
	 * Anchors of an old site path (a key of `redirects`) that forward
	 * somewhere other than its own target: old path -> anchor id -> target.
	 */
	redirectAnchors: Record<string, Record<string, string>>;
	/** Links at the right of the header (`socialLinks` in the config). */
	socialLinks: SocialLink[];
};

/** A link in the header to somewhere else: the repository, a chat. */
export type SocialLink = {link: string; icon: string | null; label: string};

/** Loads a page's module by its route. */
export type PageLoaders = Record<string, () => Promise<{default: DocModule}>>;
