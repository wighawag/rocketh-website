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
