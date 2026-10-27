/**
 * Turn an attribute's text into a component prop: numbers, booleans and JSON
 * become values, anything else stays text. Shared by the build (directive
 * attributes, `::component{start=3}`) and the browser (attributes of a tag
 * mapped to a component, `<docs-counter start="3">`), so both read the same.
 */
export function coerceProp(value: string): unknown {
	if (value === 'true') return true;
	if (value === 'false') return false;
	if (value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
	if (/^[[{"]/.test(value)) {
		try {
			return JSON.parse(value);
		} catch {
			// not JSON after all: keep the text
		}
	}
	return value;
}
