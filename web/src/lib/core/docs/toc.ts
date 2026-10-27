import {writable, type Readable} from 'svelte/store';

/**
 * Which heading of the page the reader is in: the last one whose top has
 * scrolled past `offset` pixels from the top of the viewport (the sticky
 * header plus a little). At the very bottom of the page, the last heading
 * wins, even when it is too short to reach that line.
 */
export function createActiveHeading(offset = 96): Readable<string | null> & {
	/** Track these ids in this document. Returns the cleanup. */
	track: (ids: string[]) => () => void;
} {
	const active = writable<string | null>(null);

	function track(ids: string[]): () => void {
		if (typeof window === 'undefined' || ids.length === 0) {
			active.set(null);
			return () => {};
		}
		let frame = 0;
		const update = () => {
			frame = 0;
			const elements = ids
				.map((id) => document.getElementById(id))
				.filter((e): e is HTMLElement => e !== null);
			if (elements.length === 0) return active.set(null);
			const atBottom =
				window.innerHeight + window.scrollY >=
				document.documentElement.scrollHeight - 2;
			if (atBottom) return active.set(elements.at(-1)!.id);
			let current: string | null = null;
			for (const element of elements) {
				if (element.getBoundingClientRect().top <= offset) current = element.id;
				else break;
			}
			active.set(current);
		};
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		update();
		window.addEventListener('scroll', schedule, {passive: true});
		window.addEventListener('resize', schedule, {passive: true});
		return () => {
			if (frame) cancelAnimationFrame(frame);
			window.removeEventListener('scroll', schedule);
			window.removeEventListener('resize', schedule);
		};
	}

	return {subscribe: active.subscribe, track};
}
