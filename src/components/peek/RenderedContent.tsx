import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { PdfView } from "@/components/peek/PdfView";
import { highlight, toSafeHtml } from "@/lib/markdown";
import { getWorkFileUrl } from "@/lib/work-files.functions";
import { fileNameFor, needsTextFetch, peekFormat, type PeekFormat } from "@/lib/peek-format";
import type { WorkItemRow } from "@/lib/work-types";

function useFileUrl(item: WorkItemRow, enabled: boolean) {
  const fetchUrl = useServerFn(getWorkFileUrl);
  return useQuery({
    queryKey: ["work-file-url", item.id],
    enabled: enabled && Boolean(item.content_ref),
    staleTime: 4 * 60 * 1000,
    queryFn: async () => (await fetchUrl({ data: { work_item_id: item.id, inline: true } })).url,
  });
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function FallbackCard({
  item,
  label,
  onDownload,
}: {
  item: WorkItemRow;
  label: string;
  onDownload: () => void;
}) {
  const link = item.meta?.web_view_link ?? null;
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-5 py-6 shadow-card">
      <p className="text-sm text-foreground">Preview isn&apos;t available for this format.</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
        >
          <Download className="h-3.5 w-3.5" aria-hidden /> Download
        </button>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open in Drive
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function RenderedContent({
  item,
  format,
  onDownload,
}: {
  item: WorkItemRow;
  format?: PeekFormat;
  onDownload: () => void;
}) {
  const shape = format ?? peekFormat(item);
  const wantsText = needsTextFetch(shape);
  const urlQuery = useFileUrl(item, shape.kind !== "none" && shape.kind !== "unsupported");
  const [rendered, setRendered] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const url = urlQuery.data ?? null;

  useEffect(() => {
    if (!wantsText || !url) return;
    let cancelled = false;
    setRendered(null);
    setFailed(null);
    void (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Couldn't load this file (${response.status}).`);
        const raw = await response.text();
        const html =
          shape.kind === "code"
            ? await highlight(raw, shape.language)
            : await toSafeHtml(
                raw,
                shape.kind === "markdown" ? "markdown" : shape.kind === "svg" ? "svg" : "html",
              );
        if (!cancelled) setRendered(html);
      } catch (e) {
        if (!cancelled) setFailed((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, wantsText, shape.kind, shape.kind === "code" ? shape.language : null]);

  if (shape.kind === "none") {
    return (
      <Notice>Nothing is stored for this item, it&apos;s a record of work, not a file.</Notice>
    );
  }
  if (shape.kind === "unsupported") {
    return <FallbackCard item={item} label={shape.label} onDownload={onDownload} />;
  }
  if (urlQuery.isError) {
    return <Notice>{(urlQuery.error as Error).message}</Notice>;
  }
  if (!url) return <Notice>Loading preview…</Notice>;

  if (shape.kind === "image") {
    return (
      <img
        src={url}
        alt={item.title}
        className="max-w-full rounded-[var(--radius)] border border-border"
      />
    );
  }

  // A sandboxed frame can refuse the browser's built-in PDF viewer entirely,
  // which is what left a grey broken-file box here. We render it ourselves.
  if (shape.kind === "pdf") return <PdfView url={url} title={item.title} />;

  if (failed) return <FallbackCard item={item} label={failed} onDownload={onDownload} />;
  if (rendered === null) return <Notice>Loading preview…</Notice>;

  if (shape.kind === "code") {
    return (
      <div>
        <p className="micro-label mb-2">{shape.language ?? "code"}</p>
        <pre className="overflow-x-auto rounded-[var(--radius)] border border-border bg-secondary px-4 py-3 font-mono text-[13px] leading-relaxed">
          <code dangerouslySetInnerHTML={{ __html: rendered }} />
        </pre>
      </div>
    );
  }

  return <div className="peek-prose" dangerouslySetInnerHTML={{ __html: rendered }} />;
}

export { fileNameFor };
