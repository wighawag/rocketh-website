---
title: 'rocketh, the successor to hardhat-deploy'
date: 2026-10-28
description: 'What rocketh is, what stays the same for a hardhat-deploy v1 project, what changed and why, and how to migrate.'
---

If you deploy contracts with hardhat-deploy v1, this is about the version that replaces it. hardhat-deploy v2 is built on rocketh, a deployment system that is not tied to Hardhat, and most of what you know from v1 carries over. This article says where rocketh comes from, what it is, what stays the same, what changed and why, how to migrate, and what the design was checked against.

## Where it comes from

rocketh is older than hardhat-deploy. Its [first commit](https://github.com/wighawag/rocketh/commit/773e6d4b6334eec6a67511fdb1613d2176ef5c4c), in November 2018, described it as "a simple lib to test ethereum smart contract that allow to use whatever web3 lib and test runner you choose". The same deployment steps ran for tests and for a real deployment, and named accounts were added in March 2019.

Buidler, as Hardhat was called then, had no deployment system, and in September 2019 its developers opened an [issue](https://github.com/NomicFoundation/hardhat/issues/381) asking for one as a plugin. Its author pointed to rocketh there a few weeks later, and in March 2020 its approach was rebuilt as a Buidler plugin, buidler-deploy, which became hardhat-deploy when Buidler was renamed. That plugin is the one most people know: it became widely used, and still has about 65,000 downloads a week on npm.

hardhat-deploy v1 was one package built into Hardhat. Its deploy scripts received the Hardhat runtime environment, and deploying, proxies, diamonds, export and verification shipped together. The field then changed: Foundry arrived, and in the [2024 Solidity Developer Survey](https://www.soliditylang.org/blog/2025/04/25/solidity-developer-survey-2024-results/) 51.1% of respondents used Foundry and 32.9% used Hardhat. A deployment tool that only runs inside one framework leaves out a large part of the people who deploy contracts.

So rocketh was restarted in 2023 as a deployment system that depends on no framework, made of separate packages, and hardhat-deploy was rebuilt as a plugin on top of it. hardhat-deploy v2 has run on rocketh since its first prerelease in March 2025, and 2.0.0 was released in February 2026. The design was iterated on through that time, and the rest of this article is what came out of it.

## What rocketh is

rocketh is a deployment system for EVM smart contracts. You write deploy scripts, plain TypeScript functions that state what should be deployed and configured; rocketh runs them against a network, records what it deployed, and on the next run does only what differs from the chain. It does not depend on a framework: the same scripts run from the `rocketh` command line in Node, inside your tests, and in a browser.

hardhat-deploy v2 is a thin Hardhat 3 plugin on top of it. It adds the `hardhat deploy` task, typed artifacts generated at each compilation, and helpers to use your deploy scripts as test fixtures and to read networks from the environment. Everything about deploy scripts, accounts, proxies, forks and Safes is rocketh's, which is why the [hardhat-deploy section](/hardhat-deploy/) of this site is short and links into the [shared documentation](/documentation/).

## What stays the same

Deploy scripts are declarative and idempotent: a script states the result, and a re-run deploys or upgrades only what changed. Accounts are named (`deployer`, `admin`) and resolved per network, including the per-network maps and the `null` entries of v1. Scripts declare `tags` and `dependencies`, and `--tags` selects them. Deployments are recorded as one JSON file per contract per network, in a `deployments/` folder you commit. Proxies (ERC-173, UUPS, transparent with a shared ProxyAdmin), EIP-2535 diamonds and deterministic deployment (create2, and now create3) are declared rather than written by hand. `catchUnknownSigner` is still there and returns v1's `{from, to, value, data}` shape. Deployments are still exported for a frontend (`rocketh-export`) and verified on Etherscan, Sourcify or Blockscout (`rocketh-verify`).

## What is different, and why

### Modular packages

What v1 built into `hre.deployments` is now a set of packages, called extensions: `deploy` comes from `@rocketh/deploy`, `deployViaProxy` from `@rocketh/proxy`, `catchUnknownSigner` from `@rocketh/unknown-signer`, and so on. You spread the ones you use into `extensions` in `rocketh/config.ts`, and they arrive as functions on the environment your deploy script receives. At its core rocketh only saves and reads deployments, so a project installs what it uses, a package can change without touching the others, and you can [write your own extension](/documentation/extending/) the same way. The [packages page](/documentation/reference/packages/) lists them all.

### Scripts not tied to Hardhat

A v1 deploy script receives the Hardhat runtime environment, so it can only run where Hardhat runs. A rocketh script receives a rocketh environment, built by whichever runtime is driving it: `@rocketh/node` for the command line and tests, `@rocketh/web` in a browser, hardhat-deploy inside Hardhat. Contract compilation is not rocketh's job either: rocketh deploys from artifacts, so a project that compiles with Foundry or solc can use the `rocketh` command line directly ([Get started without Hardhat](/documentation/getting-started/) uses `forge`). A closer integration with Foundry is planned, starting with reading Foundry's artifacts as they are; no date is set.

### A whole app in the browser

rocketh's core reads no file and needs no Node API, so the same deploy scripts run in a browser through `@rocketh/web`, with the records kept in memory or in IndexedDB. That makes two kinds of app possible. One deploys from the page through the user's wallet: a tool that deploys contracts for its users, or a dashboard. The other boots an EVM in the tab and deploys your real system on it, so the whole app, contracts included, runs in the browser with no node behind it: an offline mode, a demo, or a game whose world lives on a chain in the tab. Because the real scripts run there, rather than a state dump made at build time, nothing goes stale when the contracts change. [Run deploy scripts in a browser](/documentation/browser/) shows how, and the [playground on the introduction page](/documentation/#try-it-here) is a working example.

### Accounts rocketh cannot sign for

Sooner or later a script makes a call it cannot sign: a proxy upgrade owned by a Safe, a diamond cut owned by a timelock. In v1 you wrapped such a call in `catchUnknownSigner`, which printed the transaction and moved on, and you re-ran after the Safe executed it.

rocketh handles this without any wrapper. When a run started from a terminal reaches a transaction whose `from` it cannot sign for, it pauses and prints the transaction, including the one function's ABI on a single line for the Safe Transaction Builder. You execute it on your Safe and paste the hash back. rocketh requires a successful receipt, checks that it is the requested call (asking you to confirm when it cannot tell), records it, and the same run continues. An upgrade with several privileged steps pauses at each one and finishes in one run. Without a terminal, in CI for example, the run does not wait: it prints the transaction and stops with `UnknownSignerError`. [Handling unknown signers](/documentation/unknown-signers/) covers the policies (`auto`, `ask`, `throw`) and how a hash is checked.

`catchUnknownSigner` is kept for the v1 defer workflow and for runs that must never block. The one change is that it takes a function rather than a promise, `catchUnknownSigner(() => execute(...))`, so that it can set the policy before the call starts; passing a promise is a type error and a runtime error that names the fix. See [deferring with `catchUnknownSigner`](/documentation/unknown-signers/#deferring-instead-of-asking-catchunknownsigner).

### Fork rehearsals

A [fork run](/documentation/fork-runs/) is a run against a node that forked a real network, marked with `--is-fork` on the `rocketh` command line or `HARDHAT_FORK` with hardhat-deploy. It reads that network's deployment records and settings and, by default, writes nothing back to them. Impersonation is on by default for a fork run, so the steps owned by a named Safe or timelock execute instead of stopping, and you see the whole upgrade run to the end against the state that really exists. The run keeps every transaction it broadcast, in order, as [captured transactions](/documentation/captured-transactions/) (`env.capturedTransactions`, or `--write-transactions <file>` on the `rocketh` command line), and the ones sent from impersonated accounts are what your Safe has to propose.

### The deployment record is a documented format

The JSON files in `deployments/` are what a frontend, an indexer or a script reads, so their fields are now [documented](/documentation/deployment-records/), with what each one holds and when it is present. Some fields changed from v1: `args` is now `argsData` (the encoded arguments), `transactionHash` is `transaction.hash`, and `history` is gone. Each network folder now has a `.chain` file holding the chain id and the genesis hash, and a run refuses a folder that belongs to another chain; a v1 `.chainId` file is accepted and replaced. The [capability map](/hardhat-deploy/migration/#the-deployment-files) lists every field that changed.

### Stability promises in 0.x

Every rocketh package is on 0.x, where a minor release may normally break things. Two surfaces are exempt, because they are the ones a project builds tooling on. [ADR 0015](https://github.com/wighawag/rocketh/blob/main/docs/adr/0015-the-deployment-record-is-a-published-format.md) lists the fields of the deployment record and promises that none of them is removed, renamed or given another meaning in any 0.x release. [ADR 0016](https://github.com/wighawag/rocketh/blob/main/docs/adr/0016-the-unknown-signer-surface-is-frozen-for-0x.md) makes the same promise for the unknown-signer surface: `catchUnknownSigner`, `withUnknownSignerPolicy`, `UnknownSignerError`, the three policies and their flags. If either promise has to change, it changes through a new ADR published before the release that relies on it.

## Migrating

For most deploy scripts the port is a set of renames. `from` becomes `account`, the artifact is passed explicitly from the typed `artifacts` module, `proxy` options move to `deployViaProxy`, and `tags` move into the second argument of `deployScript`. Here is a transparent proxy behind the shared `DefaultProxyAdmin`, in v1 and in v2:

```typescript
// hardhat-deploy v1
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy} = deployments;
	const {deployer} = await getNamedAccounts();

	await deploy('GreetingsRegistry', {
		from: deployer,
		args: ['hello: '],
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			viaAdminContract: 'DefaultProxyAdmin',
		},
		log: true,
	});
};
export default func;
func.tags = ['GreetingsRegistry'];
```

```typescript
// hardhat-deploy v2
import {deployScript, artifacts} from '../rocketh/deploy.js';

export default deployScript(
	async ({deployViaProxy, namedAccounts}) => {
		const {deployer} = namedAccounts;

		await deployViaProxy(
			'GreetingsRegistry',
			{
				account: deployer,
				artifact: artifacts.GreetingsRegistry,
				args: ['hello: '],
			},
			{proxyContract: 'SharedAdminOpenZeppelinTransparentProxy'},
		);
	},
	{tags: ['GreetingsRegistry']},
);
```

The rest of a migration is the project around the scripts: Hardhat 3 and ESM, named accounts moving from `hardhat.config.ts` to `rocketh/config.ts`, and tests using Hardhat's `loadFixture` over your deploy scripts. Not everything has a v2 equivalent, and some differences fail late rather than at compile time: a v1 `skip` export is ignored, and three built-in proxy names changed. So start in this order:

1. [Coming from hardhat-deploy v1: what changed](/hardhat-deploy/migration/), the capability map. Every v1 capability is listed as the same, replaced, not supported, or not supported yet, so you know before starting whether your project can move.
2. [Migrating, step by step](/hardhat-deploy/migration/step-by-step/), from dependencies to tests.
3. If you work with a coding assistant, give it the [migration skill](https://github.com/wighawag/rocketh/blob/main/skills/hardhat-deploy-migration/SKILL.md) (`skills/hardhat-deploy-migration/` in the rocketh repository). It tells the assistant to check the capability map first and not to invent a translation the map does not give.

The examples in the skill are not written from memory. They are copies of the [migration pairs](https://github.com/wighawag/rocketh/tree/main/packages/hardhat-deploy/test/migration-pairs), v1 scripts next to their v2 ports, from plain deploys to proxies, diamonds, named accounts and test fixtures. The v2 half of each pair is type-checked and executed in rocketh's test suite, and a test fails when a code block in the skill no longer matches its pair. The sample above is adapted from one of them.

## Checked against real setups

- Three public hardhat-deploy v1 projects had their deploy and governance scripts [ported as tests](https://github.com/wighawag/rocketh/tree/main/packages/rocketh-unknown-signer/test/ported-protocols), run against a rocketh environment over a mock node. [Metronome Synth](https://github.com/autonomoussoftware/metronome-synth-public): proxies behind a ProxyAdmin owned by a Safe, one implementation shared by many proxies, and Safe-only calls caught with `catchUnknownSigner` and proposed as a batch at the end of the run. [Vesper](https://github.com/vesperfi/vesper-contracts): a script that reads on chain who owns the ProxyAdmin, upgrades directly when the deployer does, and otherwise proposes both upgrades to the Safe as one MultiSend. [Odyssey](https://github.com/odyssey-finance/odyssey-contracts-public): contracts deployed through a create3 factory owned by the Safe, which only whitelisted callers may use, and strategy implementations registered by the Safe. Odyssey's OpenZeppelin 5 transparent proxies, which create their own ProxyAdmin, are not one of the proxy kinds `deployViaProxy` deploys; the test pins that and the workaround that works today.
- Aave V3's governance shape, where the `PoolAddressesProvider` owns its proxies directly and its own getter returns the same proxy address before and after an upgrade, is [tested](https://github.com/wighawag/rocketh/blob/main/packages/rocketh-read-execute/test/execute-guard-storage.integration.test.ts) with an [execute guard](/documentation/execute-guard/) that reads the proxy's implementation slot, so a re-run knows whether the upgrade has landed.
- A Safe-owned upgrade was run for real on Sepolia: deploy with a Safe as the proxy owner, rehearse the upgrade on a fork, execute it through the Safe app, and re-run to see that nothing is sent. It is written up as [A Safe-owned project, end to end](/documentation/safe-owned-project/), and the project is a branch of template-ethereum-contracts.

## Thanks

An Ethereum Foundation grant gave an important boost to the work of settling rocketh's stability. Thank you.

## Where to start

- New project with Hardhat: [Get started with hardhat-deploy](/hardhat-deploy/getting-started/), or `hardhat-deploy init`.
- Existing v1 project: the [capability map](/hardhat-deploy/migration/), then the [step-by-step guide](/hardhat-deploy/migration/step-by-step/).
- Without Hardhat: [Get started without Hardhat](/documentation/getting-started/).

Questions and problems go to the [rocketh repository's issues](https://github.com/wighawag/rocketh/issues).
