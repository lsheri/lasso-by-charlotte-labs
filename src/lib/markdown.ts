/**
 * The one markdown/HTML rendering pipeline in the app. Everything rendered
 * through here is untrusted (AI output, uploaded artifacts), so it always goes
 * through DOMPurify before it touches the DOM.
 */
export async function toSafeHtml(
  raw: string,
  mode: "markdown" | "html" | "svg",
): Promise<string> {
  const [{ marked }, { default: DOMPurify }] = await Promise.all([
    import("marked"),
    import("dompurify"),
  ]);
  const source =
    mode === "markdown" ? await marked.parse(raw, { async: true, gfm: true, breaks: true }) : raw;
  return DOMPurify.sanitize(source, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["style", "srcdoc", "formaction"],
  });
}

export async function highlight(code: string, language: string | null): Promise<string> {
  const { default: hljs } = await import("highlight.js/lib/common");
  const { default: DOMPurify } = await import("dompurify");
  const result =
    language && hljs.getLanguage(language)
      ? hljs.highlight(code, { language })
      : hljs.highlightAuto(code);
  return DOMPurify.sanitize(result.value);
}
