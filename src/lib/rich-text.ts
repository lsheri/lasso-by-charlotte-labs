import DOMPurify from "dompurify";

export const PALETTE = {
  text: ["var(--nb-ink)", "var(--nb-mid)", "var(--nb-green)", "var(--nb-region-blue-vivid)", "var(--nb-region-rose-vivid)", "var(--nb-region-yellow-vivid)"],
  highlight: ["var(--nb-region-yellow-soft)", "var(--nb-sticky-green)", "var(--nb-region-blue-soft)", "var(--nb-region-rose-soft)"],
} as const;
export const SIZES = { small: "11.5px", body: "13px", large: "16px", heading: "20px" } as const;
export const RICH_TEXT_CSS = `.rich-text { color: var(--nb-ink); font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
.rich-text p { margin: 0; } .rich-text > * + * { margin-top: .35em; }
.rich-text ul, .rich-text ol { padding-left: 1.25em; } .rich-text ul { list-style: disc; } .rich-text ol { list-style: decimal; }
.rich-text li + li { margin-top: .1em; } .rich-text h3 { font-size: 20px; font-weight: 600; }
.rich-text blockquote { padding-left: .75em; border-left: var(--stroke-pencil) solid var(--nb-pencil); }
.rich-text mark { background-color: var(--nb-region-yellow-soft); color: inherit; }`;

const TAGS = ["p", "br", "strong", "b", "em", "i", "u", "s", "mark", "span", "ul", "ol", "li", "h3", "blockquote"];
const allowedStyles: Record<string, readonly string[]> = {
  color: PALETTE.text,
  "background-color": PALETTE.highlight,
  "font-size": Object.values(SIZES),
};

/** Browser-only sanitisation; without a DOM, fail closed. */
export function sanitizeRichHtml(html: string): string {
  if (typeof document === "undefined" || typeof DOMPurify.sanitize !== "function") return "";
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ["style"], ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false });
  const template = document.createElement("template");
  template.innerHTML = clean;
  for (const element of template.content.querySelectorAll("[style]")) {
    const kept = (element.getAttribute("style") ?? "").split(";").flatMap((declaration) => {
      const colon = declaration.indexOf(":");
      if (colon < 0) return [];
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      return allowedStyles[property]?.includes(value) ? [`${property}: ${value}`] : [];
    });
    if (kept.length) element.setAttribute("style", kept.join("; "));
    else element.removeAttribute("style");
  }
  return template.innerHTML;
}

export function richToPlainText(html: string): string {
  if (typeof document === "undefined") return "";
  const template = document.createElement("template");
  template.innerHTML = sanitizeRichHtml(html);
  const walk = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent ?? "";
    const tag = node instanceof Element ? node.tagName.toLowerCase() : "";
    if (tag === "br") return "\n";
    const children = Array.from(node.childNodes).map(walk).join("");
    if (tag === "li") return `- ${children.replace(/\n+$/, "")}\n`;
    if (["p", "h3", "blockquote", "ul", "ol"].includes(tag)) return `${children.replace(/\n+$/, "")}\n`;
    return children;
  };
  return walk(template.content).replace(/\n+$/, "");
}

export function plainToRichHtml(text: string): string {
  const escape = (line: string) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const result: string[] = [];
  let inList = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^- /.test(line)) {
      if (!inList) result.push("<ul>");
      inList = true;
      result.push(`<li>${escape(line.slice(2))}</li>`);
    } else {
      if (inList) result.push("</ul>");
      inList = false;
      result.push(`<p>${escape(line) || "<br>"}</p>`);
    }
  }
  if (inList) result.push("</ul>");
  return result.join("");
}