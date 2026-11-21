/** Text that hardly compresses (xorshift32 over 90 printable characters). */
export function incompressible(chars: number): string {
	let text = '';
	let seed = 2463534242;
	while (text.length < chars) {
		seed ^= seed << 13;
		seed ^= seed >>> 17;
		seed ^= seed << 5;
		text += String.fromCharCode(33 + ((seed >>> 0) % 90));
	}
	return text;
}

/**
 * Stand-ins for the playground's two bases, for `decodeOverlay`: the starting
 * project holds a Counter sample and the bare one is empty, so a link that
 * names `base: "bare"` opens exactly its own files, and one that does not
 * opens them beside the Counter.
 */
export const STAND_IN_BASES = {
	starting: {
		'contracts/Counter.sol': 'contract Counter {}\n',
		'deploy/01_deploy_counter.ts': '// deploy the Counter\n',
	},
	bare: {},
};
