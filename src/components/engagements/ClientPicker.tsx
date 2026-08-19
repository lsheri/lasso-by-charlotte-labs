import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, renameClient, useClients, useInvalidateClients } from "@/hooks/use-clients";

/**
 * Client is optional everywhere. Pick one, make one on the spot, or leave it
 * out and nothing changes about how the engagement works.
 */
export function ClientPicker({
  orgId,
  value,
  onChange,
  id = "client-picker",
}: {
  orgId: string | undefined;
  value: string | null;
  onChange: (clientId: string | null) => void;
  id?: string;
}) {
  const { data: clients } = useClients(orgId);
  const invalidate = useInvalidateClients();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const picked = (clients ?? []).find((client) => client.id === value) ?? null;

  async function create() {
    if (!orgId || !name.trim()) return;
    setPending(true);
    try {
      const clientId = await createClient({ orgId, name: name.trim(), quickFolder: false });
      invalidate();
      onChange(clientId);
      setCreating(false);
      setName("");
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
      toast.success("Client renamed.");
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
        Client (optional)
      </Label>
      {creating || renaming ? (
        <div className="flex gap-2">
          <Input
            id={id}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={renaming ? "New client name" : "Client name"}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
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
      ) : (
        <div className="flex gap-2">
          <select
            id={id}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            className="h-10 w-full rounded-[var(--radius)] border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="">No client</option>
            {(clients ?? [])
              .filter((client) => !client.quick_folder)
              .map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
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
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="shrink-0 rounded-full border border-border bg-card px-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
          >
            New
          </button>
        </div>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
