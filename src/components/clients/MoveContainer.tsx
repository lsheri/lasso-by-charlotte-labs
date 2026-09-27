import { useEffect, useMemo, useState } from "react";

import { useProfile } from "@/hooks/use-profile";
import { reparentClient, useClients, useInvalidateClients } from "@/hooks/use-clients";
import { containerDepth, eligibleParents, type ContainerRow } from "@/lib/nav-groups";
import { isCoach } from "@/lib/role-access";
import { logEvent } from "@/lib/telemetry";

type Props = {
  clientId: string;
  kind: "client" | "folder" | null | undefined;
  parentId: string | null;
  quickFolder: boolean;
};

/**
 * Moves a folder inside another container, or back to the top level.
 *
 * Only a folder is moveable. A client is never offered this control, because
 * the sidebar deliberately does not represent client nesting (see the comment
 * on partitionContainers): a Move on a client would appear to work and change
 * nothing visible. A coach never sees it, and a quick folder never moves.
 *
 * Authorization stays server side. The write asks for its row back, so a
 * refusal surfaces as CLIENT_MOVE_REFUSAL rather than reading as a save.
 */
export function MoveContainer({ clientId, kind, parentId, quickFolder }: Props) {
  const { data: profile } = useProfile();
  if (kind !== "folder") return null;
  if (!profile || isCoach(profile)) return null;
  if (quickFolder) return null;
  return <MoveContainerInner clientId={clientId} parentId={parentId} orgId={profile.org_id} />;
}

/** Holds the useClients call, so a coach never reads the workspace's rows. */
function MoveContainerInner({
  clientId,
  parentId,
  orgId,
}: {
  clientId: string;
  parentId: string | null;
  orgId: string;
}) {
  const { data } = useClients(orgId);
  const invalidateClients = useInvalidateClients();
  const [current, setCurrent] = useState(parentId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setCurrent(parentId ?? ""), [parentId]);

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
  const options = useMemo(() => eligibleParents(rows, clientId), [rows, clientId]);

  async function onChange(value: string) {
    setError(null);
    setSaving(true);
    try {
      await reparentClient({ clientId, parentId: value || null });
      setCurrent(value);
      invalidateClients();
      logEvent("container.reparented", orgId, {
        kind: "folder",
        depth: value ? containerDepth(rows, value) + 1 : 0,
        action: value ? "set" : "cleared",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not move.");
    } finally {
      setSaving(false);
    }
  }

  const selectId = `move-container-${clientId}`;
  return (
    <div className="min-w-[180px]">
      <label htmlFor={selectId} className="text-sm text-muted-foreground">
        Inside
      </label>
      <select
        id={selectId}
        value={current}
        disabled={saving}
        onChange={(event) => void onChange(event.target.value)}
        className="h-10 w-full rounded-[var(--radius)] border border-border bg-card px-3 text-sm text-foreground"
      >
        <option value="">Top level</option>
        {options.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
