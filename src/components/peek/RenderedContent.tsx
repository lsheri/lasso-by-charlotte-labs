import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { PdfView } from "@/components/peek/PdfView";
import { highlight, toSafeHtml } from "@/lib/markdown";
import { getWorkFileUrl } from "@/lib/work-files.functions";
import { getItemTextPane } from "@/lib/item-text.functions";
import { contentsUnread, textStatusOf, textStatusReason } from "@/lib/text-status";
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

const DRIVE_CAVEAT =
  "This preview comes from Google Drive and needs your own Drive access. Use Open in Drive if it stays blank.";

/**
 * The file never leaves Google: the frame loads in the reader's own Drive
 * session, so no bytes pass through Lasso or any third party viewer.
 * Future note: a Content-Security-Policy on this app must allow
 * frame-src https://drive.google.com or this preview goes blank.
 */
function DrivePreview({ fileId, title }: { fileId: string; title: string }) {
  return (
    <div>
      <div className="aspect-[3/4] w-full overflow-hidden rounded-[var(--radius)] border border-border md:aspect-[4/3]">
        <iframe
          src={`https://drive.google.com/file/d/${fileId}/preview`}
          title={title}
          className="h-full w-full"
          allow="autoplay"
          referrerPolicy="no-referrer"
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{DRIVE_CAVEAT}</p>
    </div>
  );
}

/** Plain text for formats a browser cannot render. No layout, and it says so. */
function TextPane({ item }: { item: WorkItemRow }) {
  const fetchText = useServerFn(getItemTextPane);
  const query = useQuery({
    queryKey: ["item-text-pane", item.id],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => await fetchText({ data: { work_item_id: item.id } }),
  });

  if (query.isPending) return <Notice>Reading the file…</Notice>;
  if (query.isError) return <Notice>{(query.error as Error).message}</Notice>;
  const pane = query.data;
  if (!pane?.text) {
    return (
      <Notice>
        Lasso could not read this file&apos;s contents
        {pane?.note ? `: ${pane.note}.` : "."} You can still download the original.
      </Notice>
    );
  }
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        Text extracted from the original file. Layout and images are not shown.
      </p>
      <pre className="mt-2 max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-[var(--radius)] border border-border bg-secondary px-4 py-3 text-[13px] leading-relaxed">
        {pane.text}
      </pre>
    </div>
  );
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
  const unread = contentsUnread(item.meta as never);
  const reason = textStatusReason(item.meta as never);
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-5 py-6 shadow-card">
      <p className="text-sm text-foreground">Preview isn&apos;t available for this format.</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      {unread ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Lasso could not read this file&apos;s contents{reason ? `: ${reason}` : ""}. Only its
          title is available to analysis.
        </p>
      ) : null}
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
  const driveFileId = item.meta?.drive_file_id ?? null;
  // A Drive file is shown by Drive itself, so no signed storage URL is minted.
  const urlQuery = useFileUrl(
    item,
    !driveFileId && shape.kind !== "none" && shape.kind !== "unsupported",
  );
  const [rendered, setRendered] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const url = urlQuery.data ?? null;
  const readStatus = textStatusOf(item.meta as never);

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
  // A Drive file is shown by Drive itself, in the reader's own session.
  if (driveFileId) return <DrivePreview fileId={driveFileId} title={item.title} />;
  if (shape.kind === "unsupported") {
    // Office and OpenDocument files cannot be rendered, but their text can be
    // read, and that text is what analysis sees.
    if (readStatus === "ok" || readStatus === "not_attempted") {
      return <TextPane item={item} />;
    }
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
