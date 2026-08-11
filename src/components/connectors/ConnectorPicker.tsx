import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
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
import {
  browseDriveFiles,
  browseGranolaMeetings,
  importDriveFiles,
  importGranolaMeetings,
} from "@/lib/connector-picker.functions";

type Crumb = { id: string | null; name: string };

export type PickerKind = "googledrive" | "granola";

const COPY: Record<
  PickerKind,
  { title: string; searchLabel: string; empty: string; action: string }
> = {
  googledrive: {
    title: "Browse Google Drive",
    searchLabel: "Search your Drive",
    empty: "Nothing here yet.",
    action: "Bring into Lasso",
  },
  granola: {
    title: "Browse Granola meetings",
    searchLabel: "Search meetings",
    empty: "Nothing here yet.",
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
}: {
  kind: PickerKind;
  trigger?: React.ReactNode;
  /** Controlled mode: onboarding opens the picker itself right after connect. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const browse = useServerFn(kind === "googledrive" ? browseDriveFiles : browseGranolaMeetings);
  const bring = useServerFn(kind === "googledrive" ? importDriveFiles : importGranolaMeetings);

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
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: null, name: "My Drive" }]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const folderId = crumbs[crumbs.length - 1]?.id ?? null;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void browse({
      data: {
        profile_id: profile?.id,
        ...(folderId ? { folder_id: folderId } : {}),
        ...(term ? { search: term } : {}),
      },
    })
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
  }, [open, folderId, term, profile?.id, browse]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openFolder(item: PickerItem) {
    setTerm("");
    setSearch("");
    setCrumbs((prev) => [...prev, { id: item.id, name: item.title }]);
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);
    setError(null);
    try {
      const result = await bring({ data: { profile_id: profile?.id, ids: Array.from(selected) } });
      toast.success(
        result.imported > 0
          ? `${result.imported} item${result.imported === 1 ? "" : "s"} brought into Work`
          : "Nothing new to bring in",
      );
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
      setTerm((t) => t);
      const refreshed = await browse({
        data: {
          profile_id: profile?.id,
          ...(folderId ? { folder_id: folderId } : {}),
          ...(term ? { search: term } : {}),
        },
      });
      setPage(refreshed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const copy = COPY[kind];
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
          setCrumbs([{ id: null, name: "My Drive" }]);
          setSearch("");
          setTerm("");
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="page-title">{copy.title}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">Nothing is imported unless you select it.</p>

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

        {kind === "googledrive" ? (
          <div className="flex flex-wrap items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {crumbs.map((crumb, i) => (
              <span key={`${crumb.id ?? "root"}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <span>/</span> : null}
                <button
                  type="button"
                  className="hover:text-foreground"
                  onClick={() => {
                    setTerm("");
                    setSearch("");
                    setCrumbs((prev) => prev.slice(0, i + 1));
                  }}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
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
            {kind === "googledrive" && folders.length > 0 ? (
              <div>
                <p className="micro-label">Folders</p>
                <ul className="mt-2 divide-y divide-border rounded-[var(--radius)] border border-border bg-card">
                  {folders.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openFolder(item)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary/50"
                      >
                        <span aria-hidden className="text-base leading-none">
                          📁
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {item.title}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          Open
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              {kind === "googledrive" ? <p className="micro-label">Files</p> : null}
              {files.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {kind === "googledrive"
                    ? "No files here — open a folder to keep browsing."
                    : copy.empty}
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-border rounded-[var(--radius)] border border-border bg-card">
                  {files.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Checkbox
                        checked={selected.has(item.id)}
                        disabled={item.alreadyInLasso}
                        onCheckedChange={() => toggle(item.id)}
                        aria-label={`Select ${item.title}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{item.title}</p>
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
