/** The icon names `SocialIcon.svelte` draws. Anything else shows its label. */
export const SOCIAL_ICONS = ['github'] as const;

export function hasSocialIcon(icon: string | null): boolean {
	return !!icon && (SOCIAL_ICONS as readonly string[]).includes(icon);
}
