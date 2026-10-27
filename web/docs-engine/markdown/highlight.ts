/**
 * Shiki, with a light and a dark theme in the same markup: each token carries
 * both colours, and `app.css` picks one by the `.dark` class mode-watcher sets.
 */
import {
	bundledLanguages,
	createHighlighter,
	type BundledLanguage,
	type Highlighter,
} from 'shiki';
import type {AnyNode} from './tree.js';

export type CodeThemes = {light: string; dark: string};

let highlighter: Promise<Highlighter> | null = null;
let loadedThemes = '';

function getHighlighter(themes: CodeThemes): Promise<Highlighter> {
	const key = `${themes.light}|${themes.dark}`;
	if (!highlighter || loadedThemes !== key) {
		loadedThemes = key;
		// Languages are loaded on first use, so a site pays only for the ones
		// its pages contain.
		highlighter = createHighlighter({
			themes: [themes.light, themes.dark],
			langs: [],
		});
	}
	return highlighter;
}

const ALIASES: Record<string, string> = {
	sh: 'bash',
	shell: 'bash',
	zsh: 'bash',
	console: 'bash',
	js: 'javascript',
	ts: 'typescript',
	yml: 'yaml',
	md: 'markdown',
	sol: 'solidity',
};

/** The language Shiki will use for a fence's info string, or `text`. */
export async function resolveLanguage(
	lang: string | undefined,
	themes: CodeThemes,
): Promise<string> {
	const wanted = (lang ?? '').toLowerCase();
	const name = ALIASES[wanted] ?? wanted;
	if (!name || name === 'text' || name === 'txt' || name === 'plain')
		return 'text';
	if (!(name in bundledLanguages)) return 'text';
	const h = await getHighlighter(themes);
	if (!h.getLoadedLanguages().includes(name)) {
		await h.loadLanguage(name as BundledLanguage);
	}
	return name;
}

/** Highlight `code` as a hast `<pre class="shiki">` element. */
export async function highlight(
	code: string,
	lang: string | undefined,
	themes: CodeThemes,
): Promise<AnyNode> {
	const language = await resolveLanguage(lang, themes);
	const h = await getHighlighter(themes);
	const root = h.codeToHast(code, {
		lang: language,
		themes: {light: themes.light, dark: themes.dark},
		defaultColor: 'light',
	}) as unknown as AnyNode;
	return root.children![0];
}
