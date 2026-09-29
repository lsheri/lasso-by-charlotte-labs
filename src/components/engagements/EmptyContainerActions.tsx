import { useState } from "react";

import { createContainer } from "@/components/engagements/create-container";
import { GraphiteIcon } from "@/components/notebook/icons";
import { Input } from "@/components/ui/input";
import { useClients, useInvalidateClients } from "@/hooks/use-clients";
import { useProfile } from "@/hooks/use-profile";
import { splitsByKind, vocabFor } from "@/lib/edu-vocab";

/**
 * The first containers in a fresh workspace. Where the container word is
 * already "Folder" only the folder action shows, so two actions never read
 * the same. Refusals come back from the database and show as a toast.
 */
export function EmptyContainerActions() {
  const { data: profile } = useProfile();
  const vocab = vocabFor(profile);
  const { data: clients } = useClients(profile?.org_id);
  const invalidate = useInvalidateClients();
  const [creating, setCreating] = useState<null | "client" | "folder">(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!profile || !creating || !name.trim()) return;
    setPending(true);
    try {
      const id = await createContainer({
        orgId: profile.org_id,
        orgType: profile.org_type,
        name: name.trim(),
        kind: creating,
        parentId: null,
        rows: clients ?? [],
        from: "empty_state",
      });
      if (!id) return;
      invalidate();
      setCreating(null);
      setName("");
    } finally {
      setPending(false);
    }
  }

  if (creating) {
    return (
      <div className="flex gap-2 px-2 py-1">
        <Input
          autoFocus
          aria-label={creating === "client" ? `${vocab.client} name` : "Folder name"}
          placeholder={creating === "client" ? `${vocab.client} name` : "Folder name"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
            if (e.key === "Escape") setCreating(null);
          }}
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
    );
  }

  return (
    <>
      {splitsByKind(vocab) ? (
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
