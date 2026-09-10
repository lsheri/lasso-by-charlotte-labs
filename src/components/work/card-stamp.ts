/**
 * "02 SEP" — the mono date Figma 22:220 stamps on a card in a type column.
 *
 * Day first, month abbreviated, no year. The long `formatDate` used elsewhere
 * says "Sep 9, 2026", which is three times the width in a column that is a
 * quarter of the page.
 */
export function stampDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${d.toLocaleString("en-US", { month: "short" }).toUpperCase()}`;
}