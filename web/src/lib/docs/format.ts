/** `2026-01-15` -> `Jan 15, 2026`, read as a calendar date (no time zone). */
export function formatDate(date: string, locale = 'en'): string {
	const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!match) return date;
	const [, y, m, d] = match;
	return new Intl.DateTimeFormat(locale, {
		dateStyle: 'medium',
		timeZone: 'UTC',
	}).format(new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))));
}
