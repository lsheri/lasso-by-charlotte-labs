import { clientsEnabled } from "@/lib/workspace-settings";
import { MoreHorizontal } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  deleteContainer,
  moveWorkboard,
  renameClient,
  reparentClient,
  useClients,
  useInvalidateClients,
} from "@/hooks/use-clients";
import { useProfile } from "@/hooks/use-profile";
import {
  CONTAINER_COLOURS,
  containerColourStyle,
  type ContainerColour,
} from "@/lib/container-colour";
import {
  CONTAINER_ACTIONS_COPY as COPY,
  deleteConfirmLine,
  deletedLine,
  liftedCount,
  moveDestinationGroups,
} from "@/lib/container-actions";
import { vocabFor } from "@/lib/edu-vocab";
import { containerDepth, eligibleParents, type ContainerRow } from "@/lib/nav-groups";
import { canManageMembers } from "@/lib/role-access";
import { bucket } from "@/lib/telemetry-shared";
import { logEvent } from "@/lib/telemetry";
import { supabase } from "@/integrations/supabase/client";
import { rpcOutcome, type RpcStatus } from "@/lib/save-guard";

export type SidebarMenuTarget =
  | {
      type: "container";
      id: string;
      name: string;
      kind: "client" | "folder";
      workboards: number;
      folders: number;
      color?: ContainerColour | null;
      archivedAt?: string | null;
    }
  | { type: "workboard"; id: string; name: string; clientId: string | null };

type Mode = null | "rename" | "move" | "delete" | "colour";

async function setContainerColour(id: string, colour: ContainerColour): Promise<RpcStatus> {
  const outcome = rpcOutcome(
    await supabase.rpc("set_container_color", { p_id: id, p_color: colour }),
    "colored",
    "That colour was not saved.",
  );
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value;
}

async function archiveContainer(id: string): Promise<RpcStatus> {
  const outcome = rpcOutcome(
    await supabase.rpc("archive_container", { p_id: id }),
    "archived",
    "That container was not archived.",
  );
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value;
}

async function unarchiveContainer(id: string): Promise<RpcStatus> {
  const outcome = rpcOutcome(
    await supabase.rpc("unarchive_container", { p_id: id }),
    "unarchived",
    "That container was not brought back.",
  );
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value;
}

/**
 * Unit 4a: one menu per sidebar row. It opens from its own button, which a
 * keyboard reaches and a phone can tap, and from a right click on the row.
 * Every write goes through a function that turns a refusal into the
 * database's own words; a refusal fires no event.
 */
export function SidebarItemMenu({
  target,
  open,
  onOpenChange,
}: {
  target: SidebarMenuTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const { data: profile } = useProfile();
  const invalidate = useInvalidateClients();
  const canColour = target.type === "container" && (target.kind === "folder" || canManageMembers(profile));

  async function bringBack(targetRow: Extract<SidebarMenuTarget, { type: "container" }>) {
    try {
      await unarchiveContainer(targetRow.id);
      invalidate();
      if (profile?.org_id) {
        const archivedAt = targetRow.archivedAt ? new Date(targetRow.archivedAt).getTime() : Date.now();
        const days = Math.max(0, Math.floor((Date.now() - archivedAt) / 86_400_000));
        logEvent("container.unarchived", profile.org_id, {
          kind: targetRow.kind,
          days_archived: bucket(days),
        });
      }
      toast.success(COPY.broughtBack(targetRow.name));
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function archive(targetRow: Extract<SidebarMenuTarget, { type: "container" }>) {
    try {
      await archiveContainer(targetRow.id);
      invalidate();
      if (profile?.org_id) {
        logEvent("container.archived", profile.org_id, {
          kind: targetRow.kind,
          had_workboards: targetRow.workboards > 0,
          had_folders: targetRow.folders > 0,
        });
      }
      toast.success(COPY.archived(targetRow.name), {
        duration: 8_000,
        action: {
          label: "Undo",
          onClick: () => void bringBack({ ...targetRow, archivedAt: new Date().toISOString() }),
        },
      });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={COPY.moreActions(target.name)}
            className="shrink-0 rounded-[var(--radius-control,6px)] p-0.5 text-muted-foreground opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100"
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {target.type === "container" ? (
            <DropdownMenuItem onSelect={() => setMode("rename")}>{COPY.rename}</DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setMode("move")}>{COPY.moveTo}</DropdownMenuItem>
          {canColour ? (
            <DropdownMenuItem onSelect={() => setMode("colour")}>{COPY.colour}</DropdownMenuItem>
          ) : null}
          {target.type === "container" ? (
            <DropdownMenuItem
              onSelect={() => void (target.archivedAt ? bringBack(target) : archive(target))}
            >
              {target.archivedAt ? COPY.bringBack : COPY.archive}
            </DropdownMenuItem>
          ) : null}
          {target.type === "container" ? (
            <DropdownMenuItem onSelect={() => setMode("delete")}>{COPY.remove}</DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {mode ? <MenuDialogs target={target} mode={mode} onClose={() => setMode(null)} /> : null}
    </>
  );
}

/** Mounted only while a dialog is open, so the rows are read only then. */
function MenuDialogs({
  target,
  mode,
  onClose,
}: {
  target: SidebarMenuTarget;
  mode: Exclude<Mode, null>;
  onClose: () => void;
}) {
  const { data: profile } = useProfile();
  const vocab = vocabFor(profile);
  const orgId = profile?.org_id;
  const { data } = useClients(orgId);
  const invalidate = useInvalidateClients();
  const rows = useMemo<ContainerRow[]>(
    () =>
      (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind ?? "client",
        parent_id: row.parent_id,
        quick_folder: row.quick_folder,
      })),
    [data],
  );
  const nameOf = (id: string | null | undefined) =>
    id ? (rows.find((row) => row.id === id)?.name ?? null) : null;
  const self = target.type === "container" ? rows.find((row) => row.id === target.id) : undefined;
  const parentId = target.type === "container" ? (self?.parent_id ?? null) : target.clientId;

  const [name, setName] = useState(target.name);
  const [dest, setDest] = useState(parentId ?? "");
  const [pending, setPending] = useState(false);

  async function colour(value: ContainerColour) {
    if (target.type !== "container" || !orgId) return;
    setPending(true);
    try {
      await setContainerColour(target.id, value);
      invalidate();
      logEvent("container.colored", orgId, {
        kind: target.kind,
        color: value,
        from: "menu",
      });
      onClose();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPending(false);
    }
  }

  const destinations = useMemo(() => {
    if (target.type === "container") return eligibleParents(rows, target.id);
    return rows.filter((row) => row.quick_folder !== true);
  }, [rows, target]);
  const groups = useMemo(
    () => moveDestinationGroups(destinations, vocab.clients, clientsEnabled(profile)),
    [destinations, vocab, profile],
  );

  async function run(work: () => Promise<void>) {
    setPending(true);
    try {
      await work();
      invalidate();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  const rename = () =>
    run(async () => {
      if (target.type !== "container" || !name.trim()) return;
      await renameClient({ clientId: target.id, name: name.trim() });
    });

  const move = () =>
    run(async () => {
      const to = dest || null;
      if (target.type === "container") {
        await reparentClient({ clientId: target.id, parentId: to });
        if (orgId) {
          logEvent("container.reparented", orgId, {
            kind: target.kind,
            depth: to ? containerDepth(rows, to) + 1 : 0,
            action: "menu",
          });
        }
      } else {
        await moveWorkboard({ engagementId: target.id, clientId: to });
        if (orgId) {
          logEvent("engagement.updated", orgId, {
            moved: "true",
            to_container: to ? "true" : "false",
          });
        }
      }
    });

  const remove = () =>
    run(async () => {
      if (target.type !== "container") return;
      const result = await deleteContainer(target.id);
      if (orgId) {
        logEvent("container.deleted", orgId, {
          kind: target.kind,
          had_workboards: target.workboards > 0 ? "true" : "false",
          had_folders: target.folders > 0 ? "true" : "false",
        });
      }
      toast.success(
        deletedLine({
          name: target.name,
          liftedWorkboards: liftedCount(result["lifted_workboards"]),
          liftedFolders: liftedCount(result["lifted_folders"]),
          liftedItems: liftedCount(result["lifted_items"]),
          liftedToName: nameOf(typeof result["lifted_to"] === "string" ? result["lifted_to"] : null),
          workboardWord: vocab.engagement,
        }),
      );
    });

  const close = (open: boolean) => {
    if (!open && !pending) onClose();
  };

  if (mode === "delete" && target.type === "container") {
    return (
      <AlertDialog open onOpenChange={close}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{COPY.confirmTitle(target.name)}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmLine({
                name: target.name,
                workboards: target.workboards,
                folders: target.folders,
                parentName: nameOf(parentId),
                workboardWord: vocab.engagement,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{COPY.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
            >
              {COPY.confirmAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (mode === "colour" && target.type === "container") {
    return (
      <Dialog open onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{COPY.colourTitle(target.name)}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3" role="group" aria-label="Container colours">
            {CONTAINER_COLOURS.map((value) => (
              <Button
                key={value}
                type="button"
                variant="outline"
                disabled={pending}
                aria-label={value}
                aria-pressed={target.color === value}
                onClick={() => void colour(value)}
                className="justify-start capitalize"
              >
                <span
                  aria-hidden="true"
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: containerColourStyle(value).dot }}
                />
                {value}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "rename" ? `${COPY.rename} ${target.name}` : `Move ${target.name}`}
          </DialogTitle>
        </DialogHeader>
        {mode === "rename" ? (
          <Input
            autoFocus
            aria-label="New name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void rename();
              }
            }}
          />
        ) : (
          <select
            aria-label="Destination"
            value={dest}
            onChange={(event) => setDest(event.target.value)}
            className="h-10 w-full rounded-[var(--radius)] border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="">{COPY.topLevel}</option>
            {groups.map((group) => (
              <optgroup key={group.key} label={group.label}>
                {group.rows.length > 0
                  ? group.rows.map((row) => (
                      <option key={row.id} value={row.id}>{row.name}</option>
                    ))
                  : <option disabled value="">{group.emptyLine}</option>}
              </optgroup>
            ))}
          </select>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            {COPY.cancel}
          </Button>
          <Button disabled={pending} onClick={() => void (mode === "rename" ? rename() : move())}>
            {mode === "rename" ? COPY.rename : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Right click on the row opens the same menu as its button. */
export function RowMenuShell({
  children,
  onContextMenu,
  className,
}: {
  children: ReactNode;
  onContextMenu: () => void;
  className?: string;
}) {
  return (
    <div
      className={className}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu();
      }}
    >
      {children}
    </div>
  );
}
