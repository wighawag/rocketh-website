import {goto} from '$app/navigation';

/**
 * Client-side navigation to a URL built by `route()`, for the places a link
 * cannot be a plain `<a>` (choosing a search result with the keyboard).
 */
export function navigate(url: string): Promise<void> {
	return goto(url);
}
