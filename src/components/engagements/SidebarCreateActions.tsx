import { clientsEnabled } from "@/lib/workspace-settings";
import { useState } from "react";

import { createContainer } from "@/components/engagements/create-container";
import { ContainerColourSwatches } from "@/components/engagements/ContainerColourSwatches";
import { GraphiteIcon } from "@/components/notebook/icons";
import { Input } from "@/components/ui/input";
import { useClients, useInvalidateClients } from "@/hooks/use-clients";
import type { ContainerColour } from "@/lib/container-colour";
import { useProfile } from "@/hooks/use-profile";
import { vocabFor } from "@/lib/edu-vocab";
import { canManageMembers } from "@/lib/role-access";

/**
 * Standing create actions in the sidebar, beside New workboard, shown
 * whatever the workboard count. Where the container word is already "Folder"
 * only the folder action shows, so two actions never read the same.
 * With zero workboards the event reads from "empty_state", otherwise "sidebar".
 * Refusals come back from the database and show as a toast.
 */
export function SidebarCreateActions({ empty }: { empty: boolean }) {
  const { data: profile } = useProfile();
  const { data: rows } = useClients(profile?.org_id);
  const vocab = vocabFor(profile);
  const invalidate = useInvalidateClients();
  const [creating, setCreating] = useState<null | "client" | "folder">(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<ContainerColour | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!profile || !creating || !name.trim()) return;
    setPending(true);
    try {
      const id = await createContainer({
        orgId: profile.org_id,
        name: name.trim(),
        kind: creating,
        parentId: null,
        rows: rows ?? [],
        color,
        from: empty ? "empty_state" : "sidebar",
      });
      if (!id) return;
      invalidate();
      setCreating(null);
      setName("");
      setColor(null);
    } finally {
      setPending(false);
    }
  }

  if (creating) {
    return (
      <div className="space-y-1 px-2 py-1" onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setCreating(null);
          setName("");
          setColor(null);
        }
        if (e.key === "Enter") {
          e.preventDefault();
          void submit();
        }
      }}>
        <div className="flex gap-2">
        <Input
          autoFocus
          aria-label={creating === "client" ? `${vocab.client} name` : "Folder name"}
          placeholder={creating === "client" ? `${vocab.client} name` : "Folder name"}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => void submit()}
          className="shrink-0 rounded-full border border-border bg-card px-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Add
        </button>
        </div>
        <ContainerColourSwatches value={color} onChange={setColor} disabled={pending} />
      </div>
    );
  }

  return (
    <>
      {clientsEnabled(profile) && canManageMembers(profile) ? (
        <button type="button" className="nb-nav-item w-full text-left" onClick={() => setCreating("client")}>
          <GraphiteIcon name="plus" size={20} />
          <span>{`New ${vocab.client.toLowerCase()}`}</span>
        </button>
      ) : null}
      <button type="button" className="nb-nav-item w-full text-left" onClick={() => setCreating("folder")}>
        <GraphiteIcon name="plus" size={20} />
        <span>New folder</span>
      </button>
    </>
  );
}
