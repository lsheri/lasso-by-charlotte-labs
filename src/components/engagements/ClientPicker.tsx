import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContainerColourSwatches } from "@/components/engagements/ContainerColourSwatches";
import type { ContainerColour } from "@/lib/container-colour";
import { createContainer, type ContainerFrom } from "@/components/engagements/create-container";
import { renameClient, useClients, useInvalidateClients } from "@/hooks/use-clients";
import { useProfile } from "@/hooks/use-profile";
import { vocabFor } from "@/lib/edu-vocab";
import { canManageMembers } from "@/lib/role-access";

/**
 * Client is optional everywhere. Pick one, make one on the spot, or leave it
 * out and nothing changes about how the engagement works.
 */
export function ClientPicker({
  orgId,
  value,
  onChange,
  id = "client-picker",
  from,
}: {
  orgId: string | undefined;
  value: string | null;
  /** createdInline is true when the container was made here, in this flow. */
  onChange: (clientId: string | null, createdInline?: boolean) => void;
  id?: string;
  from?: ContainerFrom;
}) {
  const { data: clients } = useClients(orgId);
  const { data: profile } = useProfile();
  const vocab = vocabFor(profile);
  const invalidate = useInvalidateClients();
  const [creating, setCreating] = useState<null | "client" | "folder">(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<ContainerColour | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const picked = (clients ?? []).find((client) => client.id === value) ?? null;

  /** The client/folder split only means something where the container word is
   *  not already "folder". In a personal workspace there are no clients, so the
   *  two groups would both read "Folders". */
  const splitByKind = vocab.client !== "Folder";

  /** A client is canonical and billable: only an admin or lead mints one.
   *  A folder is free to every member, always. The database enforces the
   *  rule; this only hides the action, and its refusal still shows verbatim. */
  const canCreateClient = canManageMembers(profile);

  /** A new folder sits inside the container picked right now, or at the top. */
  async function create() {
    if (!orgId || !name.trim() || !creating) return;
    setPending(true);
    try {
      const clientId = await createContainer({
        orgId,
        name: name.trim(),
        kind: creating,
        parentId: creating === "folder" ? (picked?.id ?? null) : null,
        rows: clients ?? [],
        color,
        from: from ?? "picker",
      });
      if (!clientId) return;
      invalidate();
      onChange(clientId, true);
      setCreating(null);
      setName("");
      setColor(null);
    } finally {
      setPending(false);
    }
  }

  /** Renaming a client relabels it everywhere it is shown. */
  async function rename() {
    if (!picked || !name.trim()) return;
    setPending(true);
    setError(null);
    try {
      await renameClient({ clientId: picked.id, name: name.trim() });
      invalidate();
      setRenaming(false);
      setName("");
      toast.success(`${vocab.client} renamed.`);
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="micro-label">
        {`${vocab.client} (optional)`}
      </Label>
      {creating || renaming ? (
        <div className="space-y-1" onKeyDown={(e) => {
          if (!creating) return;
          if (e.key === "Escape") {
            e.preventDefault();
            setCreating(null);
            setName("");
            setColor(null);
          }
          if (e.key === "Enter") {
            e.preventDefault();
            void create();
          }
        }}>
          <div className="flex gap-2">
          <Input
            id={id}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              renaming
                ? `New ${vocab.client.toLowerCase()} name`
                : creating === "folder"
                  ? picked
                    ? `Folder name, inside ${picked.name}`
                    : "Folder name"
                  : `${vocab.client} name`
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && renaming) {
                e.preventDefault();
                void (renaming ? rename() : create());
              }
            }}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => void (renaming ? rename() : create())}
            className="shrink-0 rounded-full border border-border bg-card px-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
          >
            {renaming ? "Save" : "Add"}
          </button>
          </div>
          {creating ? <ContainerColourSwatches value={color} onChange={setColor} disabled={pending} /> : null}
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            id={id}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            className="h-10 w-full rounded-[var(--radius)] border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="">{`No ${vocab.client.toLowerCase()}`}</option>
            {(clients ?? []).some(
              (client) => !client.quick_folder && (client.kind ?? "client") === "client",
            ) && splitByKind ? (
              <optgroup label={vocab.clients}>
                {(clients ?? [])
                  .filter((client) => !client.quick_folder && (client.kind ?? "client") === "client")
                  .map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
              </optgroup>
            ) : null}
            {(clients ?? []).some(
              (client) => !client.quick_folder && (client.kind ?? "client") === "folder",
            ) && splitByKind ? (
              <optgroup label="Folders">
                {(clients ?? [])
                  .filter((client) => !client.quick_folder && (client.kind ?? "client") === "folder")
                  .map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
              </optgroup>
            ) : null}
            {!splitByKind
              ? (clients ?? [])
                  .filter((client) => !client.quick_folder)
                  .map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))
              : null}
          </select>
          {picked ? (
            <button
              type="button"
              aria-label={`Rename ${picked.name}`}
              onClick={() => {
                setName(picked.name);
                setError(null);
                setRenaming(true);
              }}
              className="shrink-0 rounded-full border border-border bg-card px-3 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
          {canCreateClient || !splitByKind ? (
            <button
              type="button"
              onClick={() => setCreating(splitByKind ? "client" : "folder")}
              className="shrink-0 rounded-full border border-border bg-card px-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
            >
              {`New ${vocab.client.toLowerCase()}`}
            </button>
          ) : null}
          {splitByKind ? (
            <button
              type="button"
              onClick={() => setCreating("folder")}
              className="shrink-0 rounded-full border border-border bg-card px-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
            >
              New folder
            </button>
          ) : null}
        </div>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
