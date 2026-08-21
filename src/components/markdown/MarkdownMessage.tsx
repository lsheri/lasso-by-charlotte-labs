import { useEffect, useRef, useState } from "react";

import { toSafeHtml } from "@/lib/markdown";

/**
 * Assistant chat messages, rendered with the same marked + DOMPurify pipeline
 * the peek panel uses. Code blocks get highlighted after the sanitized HTML
 * lands, using the same highlight.js bundle.
 */
export function MarkdownMessage({
  content,
  className,
  variant,
}: {
  content: string;
  className?: string;
  /** "binder" snaps every line onto the 28px ruled baseline. */
  variant?: "binder";
}) {
  const [html, setHtml] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const safe = await toSafeHtml(content, "markdown");
      if (!cancelled) setHtml(safe);
    })();
    return () => {
      cancelled = true;
    };
  }, [content]);

  useEffect(() => {
    if (html === null || !ref.current) return;
    const blocks = ref.current.querySelectorAll<HTMLElement>("pre code");
    if (blocks.length === 0) return;
    let cancelled = false;
    void (async () => {
      const { default: hljs } = await import("highlight.js/lib/common");
      if (cancelled) return;
      blocks.forEach((block) => hljs.highlightElement(block));
    })();
    return () => {
      cancelled = true;
    };
  }, [html]);

  if (html === null) {
    return (
      <p
        className={`whitespace-pre-wrap text-sm text-foreground ${
          variant === "binder" ? "nb-binder-line" : "mt-1 leading-relaxed"
        }`}
      >
        {content}
      </p>
    );
  }

  return (
    <div
      ref={ref}
      className={`peek-prose chat-prose ${variant === "binder" ? "chat-binder" : "mt-1"} ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
