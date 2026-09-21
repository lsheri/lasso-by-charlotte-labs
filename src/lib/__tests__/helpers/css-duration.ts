/**
 * Shared check helper: read a rule's animation duration out of the stylesheet
 * and resolve a custom property to its declared value, so a check can assert
 * the timing however the rule happens to be spelled.
 */
export function cssDurationMs(source: string, selector: string): number | null {
  const rule = source.slice(source.indexOf(`${selector} {`));
  const animation = /animation:\s*[\w-]+\s+([^\s;]+)/.exec(rule.slice(0, rule.indexOf("}")));
  if (!animation) return null;
  let value = animation[1]!;
  const token = /^var\((--[\w-]+)\)$/.exec(value);
  if (token) {
    const declared = new RegExp(`${token[1]}:\\s*([^;]+);`).exec(source);
    if (!declared) return null;
    value = declared[1]!.trim();
  }
  if (value.endsWith("ms")) return Number.parseFloat(value);
  if (value.endsWith("s")) return Number.parseFloat(value) * 1000;
  return null;
}
