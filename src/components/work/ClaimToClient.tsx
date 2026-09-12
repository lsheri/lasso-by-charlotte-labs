import { Check } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient, useClients } from "@/hooks/use-clients";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { logV2 } from "@/lib/telemetry-v2";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * The coarse claim. One tap says whose work this is, without asking for a
 * workstream. Placing the piece in a workstream is the finer degree and stamps
 * the same client on its own.
 *
 * Owns its own reads so no page hook list has to change; the client list is
 * cached per org, so many rows cost one request.
 */
export function ClaimToClient({ item }: { item: WorkItemRow }) {
  const { data: profile } = useProfile();
  const { data: clients } = useClients(profile?.org_id);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const current = clients?.find((c) => c.id === item.client_id) ?? null;
  const options = (clients ?? []).filter((c) => !c.quick_folder);

  async function pick(nextId: string | null, created = false) {
    if (busy) return;
    setBusy(true);
    try {
      const wasClaimed = Boolean(item.client_id);
      const { error } = await supabase
        .from("work_items")
        .update({ client_id: nextId })
        .eq("id", item.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (nextId && profile) {
        logV2(
          "work_item.claimed_to_client",
          { item_type: item.type, was_claimed: wasClaimed },
          { profileId: profile.id, workItemId: item.id },
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
      if (created) await queryClient.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function addClient() {
    const trimmed = name.trim();
    if (!trimmed || !profile || busy) return;
    setBusy(true);
    let id: string;
    try {
      id = await createClient({ orgId: profile.org_id, name: trimmed, quickFolder: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that");
      return;
    } finally {
      setBusy(false);
    }
    setName("");
    await pick(id, true);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex min-h-11 items-center text-xs text-muted-foreground transition-colors hover:text-foreground md:min-h-0"
        >
          {current ? current.name : "Client"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[15rem] p-2"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="micro-label mb-1.5">Whose work is this?</p>
        <div className="max-h-56 overflow-y-auto">
          {options.map((client) => (
            <button
              key={client.id}
              type="button"
              disabled={busy}
              onClick={() => void pick(client.id)}
              className={`flex w-full items-center justify-between gap-2 rounded-[var(--radius)] px-2 py-1.5 text-left text-xs hover:bg-muted ${
                client.id === item.client_id ? "font-medium text-foreground" : "text-foreground"
              }`}
            >
              <span className="truncate">{client.name}</span>
              {client.id === item.client_id ? (
                <Check className="h-3 w-3 shrink-0" aria-hidden />
              ) : null}
            </button>
          ))}
          {item.client_id ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void pick(null)}
              className="flex w-full items-center rounded-[var(--radius)] px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
            >
              Not set
            </button>
          ) : null}
        </div>
        <div className="mt-2 border-t border-border pt-2">
          <div className="flex items-center gap-1.5">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New client"
              className="min-w-0 flex-1 rounded-[var(--radius)] border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="button"
              disabled={busy || name.trim().length === 0}
              onClick={() => void addClient()}
              className="shrink-0 rounded-[var(--radius)] border border-border px-2 py-1 text-xs text-foreground transition-opacity hover:opacity-70 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
