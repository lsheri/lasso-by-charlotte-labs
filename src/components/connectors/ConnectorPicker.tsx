import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, ChevronLeft, Eye, Folder, Phone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/use-profile";
import type { PickerItem, PickerPage } from "@/lib/connector-picker-shared";
import type { BrowsableToolkit } from "@/lib/connector-toolkits";
import {
  browseConnectorItems,
  browseGmailThreads,
  browseGranolaMeetings,
  importConnectorItems,
  importGmailThreads,
  importGranolaMeetings,
} from "@/lib/connector-picker.functions";
import { setFolderWatch } from "@/lib/connector-watch.functions";

type Crumb = { id: string | null; name: string };

export type PickerKind = "googledrive" | "onedrive" | "sharepoint" | "granola" | "gmail";

type FileKind = "googledrive" | "onedrive" | "sharepoint";

const TOOLKIT: Record<FileKind, BrowsableToolkit> = {
  googledrive: "googledrive",
  onedrive: "one_drive",
  sharepoint: "sharepoint_graph",
};

const COPY: Record<
  PickerKind,
  { title: string; searchLabel: string; root: string; empty: string; action: string }
> = {
  googledrive: {
    title: "Browse Google Drive",
    searchLabel: "Search your Drive",
    root: "My Drive",
    empty: "Nothing here yet.",
    action: "Bring into Lasso",
  },
  onedrive: {
    title: "Browse OneDrive",
    searchLabel: "Search your OneDrive",
    root: "My files",
    empty: "Nothing here yet.",
    action: "Bring into Lasso",
  },
  sharepoint: {
    title: "Browse SharePoint",
    searchLabel: "Search sites",
    root: "Sites",
    empty: "Nothing here yet.",
    action: "Bring into Lasso",
  },
  granola: {
    title: "Browse Granola meetings",
    searchLabel: "Search meetings",
    root: "Meetings",
    empty: "Nothing here yet.",
    action: "Bring into Lasso",
  },
  gmail: {
    title: "Browse Gmail threads",
    searchLabel: "Gmail search (e.g. from:client@acme.com has:attachment)",
    root: "Inbox",
    empty: "No threads here.",
    action: "Bring into Lasso",
  },
};

function dateLabel(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ConnectorPicker({
  kind,
  trigger,
  open: openProp,
  onOpenChange,
  initialFolder,
  highlightIds,
}: {
  kind: PickerKind;
  trigger?: React.ReactNode;
  /** Controlled mode: onboarding opens the picker itself right after connect. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Watch suggestions open the picker straight into the folder that changed. */
  initialFolder?: { id: string; name: string } | null;
  /** Provider ids to call out as new — still default-unchecked. */
  highlightIds?: string[];
}) {
  const isFolderBrowser = kind !== "granola" && kind !== "gmail";
  const isGmail = kind === "gmail";
  const copy = COPY[kind];
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const browseFiles = useServerFn(browseConnectorItems);
  const browseMeetings = useServerFn(browseGranolaMeetings);
  const browseThreads = useServerFn(browseGmailThreads);
  const importFiles = useServerFn(importConnectorItems);
  const importMeetings = useServerFn(importGranolaMeetings);
  const importThreads = useServerFn(importGmailThreads);
  const toggleWatch = useServerFn(setFolderWatch);
  const highlight = new Set(highlightIds ?? []);

  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const [page, setPage] = useState<PickerPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [crumbs, setCrumbs] = useState<Crumb[]>(
    initialFolder
      ? [
          { id: null, name: copy.root },
          { id: initialFolder.id, name: initialFolder.name },
        ]
      : [{ id: null, name: copy.root }],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [watchBusy, setWatchBusy] = useState<string | null>(null);
  /** Gmail label chips act as this picker's "folders". */
  const [labelQuery, setLabelQuery] = useState<string>("in:inbox");

  const crumbFolder = crumbs[crumbs.length - 1] ?? { id: null, name: copy.root };
  const folderId = isGmail ? labelQuery : (crumbFolder.id ?? null);
  const canGoBack = crumbs.length > 1;

  const load = useCallback((): Promise<PickerPage> => {
    const data = {
      profile_id: profile?.id,
      ...(folderId ? { folder_id: folderId } : {}),
      ...(crumbFolder.name ? { folder_name: crumbFolder.name } : {}),
      ...(term ? { search: term } : {}),
    };
    if (isFolderBrowser) {
      return browseFiles({ data: { ...data, toolkit: TOOLKIT[kind as FileKind] } });
    }
    return isGmail ? browseThreads({ data }) : browseMeetings({ data });
  }, [
    browseFiles,
    browseMeetings,
    browseThreads,
    crumbFolder.name,
    folderId,
    isFolderBrowser,
    isGmail,
    kind,
    profile?.id,
    term,
  ]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void load()
      .then((result) => {
        if (!cancelled) setPage(result);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Every navigation clears the search box, so the trail always matches the list. */
  function goTo(depth: number) {
    setTerm("");
    setSearch("");
    setCrumbs((prev) => (depth < prev.length ? prev.slice(0, depth + 1) : prev));
  }

  function goBack() {
    if (canGoBack) goTo(crumbs.length - 2);
  }

  function openFolder(item: PickerItem) {
    setTerm("");
    setSearch("");
    setCrumbs((prev) => [...prev, { id: item.id, name: item.title }]);
  }

  /** Watching only ever produces suggestions — it never imports anything. */
  async function handleWatch(item: PickerItem) {
    if (!isFolderBrowser) return;
    setWatchBusy(item.id);
    try {
      const result = await toggleWatch({
        data: {
          profile_id: profile?.id,
          toolkit: TOOLKIT[kind as FileKind],
          folder_id: item.id,
          folder_name: item.title,
          watch: !item.isWatched,
        },
      });
      toast.success(
        result.watched
          ? `Watching “${item.title}” — Lasso will suggest new files, never import them.`
          : `Stopped watching “${item.title}”`,
      );
      setPage(await load());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWatchBusy(null);
    }
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);
    setError(null);
    try {
      const ids = Array.from(selected);
      const result = isFolderBrowser
        ? await importFiles({
            data: {
              profile_id: profile?.id,
              ids,
              folder_name: crumbFolder.name,
              toolkit: TOOLKIT[kind as FileKind],
            },
          })
        : isGmail
          ? await importThreads({ data: { profile_id: profile?.id, ids } })
          : await importMeetings({ data: { profile_id: profile?.id, ids } });
      toast.success(
        result.imported > 0
          ? `${result.imported} item${result.imported === 1 ? "" : "s"} brought into Work`
          : "Nothing new to bring in",
      );
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
      setPage(await load());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const items = page?.items ?? [];
  // Folder-first: navigate into folders, then pick files inside them.
  const folders = items.filter((i) => i.isFolder);
  const files = items.filter((i) => !i.isFolder);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSelected(new Set());
          setPage(null);
          setCrumbs(
            initialFolder
              ? [
                  { id: null, name: copy.root },
                  { id: initialFolder.id, name: initialFolder.name },
                ]
              : [{ id: null, name: copy.root }],
          );
          setSearch("");
          setTerm("");
        }
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
        onKeyDown={(e) => {
          // Alt+Left / Backspace step up a level, as in a file manager.
          const typing = (e.target as HTMLElement).tagName === "INPUT";
          if ((e.key === "ArrowLeft" && e.altKey) || (e.key === "Backspace" && !typing)) {
            if (canGoBack) {
              e.preventDefault();
              goBack();
            }
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="page-title">{copy.title}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">Nothing is imported unless you select it.</p>

        {isGmail && page?.labels?.length ? (
          <nav aria-label="Gmail labels" className="flex flex-wrap gap-1.5">
            {page.labels.map((label) => {
              const active = labelQuery === label.query;
              return (
                <button
                  key={label.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setLabelQuery(label.query);
                    setSelected(new Set());
                  }}
                  className={
                    active
                      ? "rounded-full border border-accent bg-accent-soft px-3 py-1 text-xs font-medium text-accent-deep"
                      : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
                  }
                >
                  {label.name}
                </button>
              );
            })}
          </nav>
        ) : null}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setTerm(search.trim());
          }}
        >
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={copy.searchLabel}
            aria-label={copy.searchLabel}
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        {isFolderBrowser ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canGoBack}
              onClick={goBack}
              aria-label="Back to the previous folder"
            >
              <ChevronLeft aria-hidden className="size-3.5" />
              Back
            </Button>
            <nav
              aria-label="Folder trail"
              className="flex min-w-0 flex-wrap items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
            >
              {crumbs.map((crumb, i) => {
                const isLast = i === crumbs.length - 1;
                return (
                  <span key={`${crumb.id ?? "root"}-${i}`} className="flex items-center gap-1">
                    {i > 0 ? <span aria-hidden>/</span> : null}
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      aria-current={isLast ? "page" : undefined}
                      className={
                        isLast
                          ? "max-w-[16rem] truncate text-foreground"
                          : "max-w-[10rem] truncate rounded-sm underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      }
                    >
                      {crumb.name}
                    </button>
                  </span>
                );
              })}
            </nav>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {page?.unsupported ? (
          <p className="text-sm text-muted-foreground">{page.unsupported}</p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Looking…</p>
        ) : items.length === 0 && !page?.unsupported ? (
          <p className="text-sm text-muted-foreground">{copy.empty}</p>
        ) : (
          <div className="space-y-4">
            {isFolderBrowser && folders.length > 0 ? (
              <div>
                <p className="micro-label">
                  {kind === "sharepoint" ? "Sites & folders" : "Folders"}
                </p>
                <ul className="mt-2 divide-y divide-border rounded-[var(--radius)] border border-border bg-card">
                  {folders.map((item) => (
                    <li key={item.id}>
                      <div className="flex items-center gap-1 pr-2">
                        <button
                          type="button"
                          onClick={() => openFolder(item)}
                          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary/50"
                        >
                          <Folder aria-hidden className="size-4 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                            {item.title}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                            Open
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={watchBusy === item.id}
                          onClick={() => void handleWatch(item)}
                          aria-pressed={Boolean(item.isWatched)}
                          title={
                            item.isWatched
                              ? "Watching — Lasso suggests new files, never imports them"
                              : "Watch this folder for new work"
                          }
                          aria-label={
                            item.isWatched ? `Stop watching ${item.title}` : `Watch ${item.title}`
                          }
                          className={
                            item.isWatched
                              ? "flex items-center gap-1 rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-accent-deep transition-opacity hover:opacity-70 disabled:opacity-50"
                              : "flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:border-accent hover:text-foreground disabled:opacity-50"
                          }
                        >
                          {item.isWatched ? (
                            <Bell aria-hidden className="size-3" />
                          ) : (
                            <Eye aria-hidden className="size-3" />
                          )}
                          {item.isWatched ? "Watching" : "Watch"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              {isFolderBrowser ? <p className="micro-label">Files</p> : null}
              {files.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {isFolderBrowser ? "No files here — open a folder to keep browsing." : copy.empty}
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-border rounded-[var(--radius)] border border-border bg-card">
                  {files.map((item) => (
                    <li
                      key={item.id}
                      className={
                        highlight.has(item.id)
                          ? "flex items-center gap-3 border-l-2 border-l-accent bg-accent-soft/40 px-4 py-2.5"
                          : "flex items-center gap-3 px-4 py-2.5"
                      }
                    >
                      <Checkbox
                        checked={selected.has(item.id)}
                        disabled={item.alreadyInLasso}
                        onCheckedChange={() => toggle(item.id)}
                        aria-label={`Select ${item.title}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                          <span className="truncate">{item.title}</span>
                          {highlight.has(item.id) ? (
                            <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-accent-deep">
                              New
                            </span>
                          ) : null}
                          {item.hint ? (
                            <span className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                              <Phone aria-hidden className="size-2.5" />
                              {item.hint}
                            </span>
                          ) : null}
                        </p>
                        {item.subtitle ? (
                          <p className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                            {item.subtitle}
                          </p>
                        ) : null}
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        {item.alreadyInLasso ? "In Lasso" : dateLabel(item.date)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={selected.size === 0 || importing}
            onClick={() => void handleImport()}
          >
            {importing
              ? "Bringing in…"
              : `${copy.action}${selected.size ? ` (${selected.size})` : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
