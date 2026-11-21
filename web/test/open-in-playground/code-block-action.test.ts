/**
 * The "Open in playground" link (`open-in-playground/code-block-action.js`),
 * on a stand-in rocketh checkout: a marked fence gets a link that opens, as
 * the playground reads it, exactly the example's files over the bare base
 * (no Counter sample) with the named file selected; an unmarked fence renders as without the hook; a marker the
 * checkout cannot back fails the build with the page and the line.
 */
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {resolveConfig} from '../../docs-engine/config.js';
import {renderMarkdown} from '../../docs-engine/markdown/render';
import {DocsSite} from '../../docs-engine/site';
import {
	LINK_LABEL,
	openInPlayground,
	PLAYGROUND_URL,
} from '../../open-in-playground/code-block-action.js';
import {encodeOverlay} from '../../open-in-playground/overlay-link.js';
import {decodeOverlay, projectValueOf} from './decode-overlay';
import {incompressible, STAND_IN_BASES} from './helpers';

const EXAMPLE = {
	'contracts/GreetingsRegistry.sol': 'contract GreetingsRegistry {}\n',
	'deploy/001_deploy_greetings_registry.ts': '// deploy it\n',
	'rocketh/config.ts': '// é, 你好\n',
};

let root: string;

function write(path: string, text: string) {
	mkdirSync(dirname(join(root, path)), {recursive: true});
	writeFileSync(join(root, path), text);
}

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), 'open-in-playground-'));
	for (const [path, text] of Object.entries(EXAMPLE)) {
		write(`examples/playground/greetings/${path}`, text);
	}
	write('examples/playground/big/contracts/Big.sol', incompressible(40_000));
});

afterAll(() => rmSync(root, {recursive: true, force: true}));

const links = {
	route: '/page/',
	source: 'page.md',
	base: '/',
	contentRoot: '/nonexistent',
	routeOfSource: () => null,
	isRoute: () => false,
	isPublicFile: () => false,
};

function render(source: string, withHook: boolean) {
	return renderMarkdown(source, {
		themes: {light: 'github-light', dark: 'github-dark'},
		links,
		codeBlockAction: withHook ? openInPlayground(root) : null,
	});
}

/** The hrefs of the page's "Open in playground" links, in order. */
const actionHrefs = (html: string) =>
	[...html.matchAll(/<a class="code-action" href="([^"]+)"[^>]*>([^<]*)</g)]
		.filter((m) => m[2] === LINK_LABEL)
		.map((m) => m[1]);

describe('openInPlayground', () => {
	it('links a marked fence to the example over the bare base, its named file selected', async () => {
		const r = await render(
			'# T\n\n```typescript playground=greetings/deploy/001_deploy_greetings_registry.ts\n// deploy it\n```\n',
			true,
		);
		expect(r.codeBlockActionErrors).toEqual([]);
		const [href, ...more] = actionHrefs(r.html);
		expect(more).toEqual([]);
		expect(href.startsWith(`${PLAYGROUND_URL}#project=2.`)).toBe(true);
		const value = projectValueOf(href);
		expect(value).not.toBeNull();
		expect(decodeOverlay(value!, STAND_IN_BASES)).toEqual({
			files: EXAMPLE,
			select: 'deploy/001_deploy_greetings_registry.ts',
		});
		expect(value).toBe(
			encodeOverlay(EXAMPLE, 'deploy/001_deploy_greetings_registry.ts', {
				base: 'bare',
			}),
		);
	});

	it('finds the marker among other words of the info string', async () => {
		const r = await render(
			'```ts [deploy] playground=greetings/contracts/GreetingsRegistry.sol\nx\n```\n',
			true,
		);
		const [href] = actionHrefs(r.html);
		expect(decodeOverlay(projectValueOf(href)!, STAND_IN_BASES).select).toBe(
			'contracts/GreetingsRegistry.sol',
		);
	});

	it('leaves a fence without the marker as it renders without the hook', async () => {
		const page =
			'# T\n\n```ts [deploy] run=1\nconst a = 1;\n```\n\n```\nplain\n```\n';
		const withHook = await render(page, true);
		const without = await render(page, false);
		expect(withHook.html).toBe(without.html);
		expect(withHook.html).not.toContain('code-action');
	});
});

describe('openInPlayground in the build', () => {
	it('fails on a missing example, a missing file, an over-cap link or a malformed marker, with page and line', async () => {
		const content = mkdtempSync(join(tmpdir(), 'open-in-playground-site-'));
		try {
			writeFileSync(
				join(content, 'index.md'),
				[
					'# Home', // 1
					'',
					'```ts playground=greetings/deploy/001_deploy_greetings_registry.ts', // 3
					'// deploy it',
					'```',
					'',
					'```ts playground=nowhere/deploy/a.ts', // 7
					'x',
					'```',
					'',
					'```ts playground=greetings/deploy/missing.ts', // 11
					'x',
					'```',
					'',
					'```sol playground=big/contracts/Big.sol', // 15
					'x',
					'```',
					'',
					'```ts playground=greetings', // 19
					'x',
					'```',
					'',
				].join('\n'),
			);
			const config = resolveConfig(
				{contentDir: content, codeBlockAction: openInPlayground(root)},
				join(content, 'docs.config.js'),
			);
			const site = new DocsSite(config, 'build');
			await site.load();
			expect(site.check()).toEqual([
				{
					source: 'index.md',
					line: 7,
					message:
						'codeBlockAction threw: playground=nowhere/deploy/a.ts: there is no example examples/playground/nowhere/ in the rocketh checkout',
				},
				{
					source: 'index.md',
					line: 11,
					message:
						'codeBlockAction threw: playground=greetings/deploy/missing.ts: the example examples/playground/greetings/ has no file deploy/missing.ts',
				},
				{
					source: 'index.md',
					line: 15,
					message: expect.stringMatching(
						/^codeBlockAction threw: playground=big\/contracts\/Big\.sol: this link would carry \d+ bytes of fragment, over the 32768 a link carries$/,
					),
				},
				{
					source: 'index.md',
					line: 19,
					message:
						'codeBlockAction threw: playground=greetings: a marker must be playground=<example>/<path>, a file inside examples/playground/<example>/',
				},
			]);
		} finally {
			rmSync(content, {recursive: true, force: true});
		}
	});
});
