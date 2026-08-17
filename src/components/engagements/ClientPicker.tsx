import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, useClients, useInvalidateClients } from "@/hooks/use-clients";

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
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

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

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="micro-label">
        Client (optional)
      </Label>
      {creating ? (
        <div className="flex gap-2">
          <Input
            id={id}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Client name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
            }}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => void create()}
            className="shrink-0 rounded-full border border-border bg-card px-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Add
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
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="shrink-0 rounded-full border border-border bg-card px-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
          >
            New
          </button>
        </div>
      )}
    </div>
  );
}
