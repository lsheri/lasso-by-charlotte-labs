import { toast } from "sonner";

import { createClient, type ClientRow } from "@/hooks/use-clients";
import { supabase } from "@/integrations/supabase/client";
import { containersBand, type ContainerColour } from "@/lib/container-colour";
import { rpcOutcome } from "@/lib/save-guard";
import { logEvent } from "@/lib/telemetry";

/** Where a container was made from. "empty_state" is the sidebar create actions. */
export type ContainerFrom = "sidebar" | "sidebar_client" | "client_page" | "home" | "picker" | "empty_state";

/** Level of a new container: 1 at the top, one more than its parent below that.
 *  Only for the event dim. The database enforces the real rule. */
export function depthFor(parentId: string | null, rows: ClientRow[]): number {
  const byId = new Map(rows.map((row) => [row.id, row]));
  let depth = 1;
  let cursor = parentId ? byId.get(parentId) : undefined;
  while (cursor && depth < 10) {
    depth += 1;
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined;
  }
  return depth;
}

/**
 * Creates a client or folder and records it. The database trigger decides
 * whether the shape is allowed; its message is shown as it came back.
 * Returns the new id, or null when the database refused.
 */
export async function createContainer(input: {
  orgId: string;
  name: string;
  kind: "client" | "folder";
  parentId: string | null;
  rows: ClientRow[];
  from: ContainerFrom;
  color?: ContainerColour | null;
}): Promise<string | null> {
  const parentId = input.kind === "client" ? null : input.parentId;
  try {
    const id = await createClient({
      orgId: input.orgId,
      name: input.name,
      kind: input.kind,
      parentId,
    });
    // One event per container. "empty_state" is sent as its own from value.
    // workspace_type is the events column, not a dim.
    logEvent("container.created", input.orgId, {
      kind: input.kind,
      from: input.from,
      depth: String(depthFor(parentId, input.rows)),
    });
    if (input.color) {
      try {
        const outcome = rpcOutcome(
          await supabase.rpc("set_container_color", { p_id: id, p_color: input.color }),
          "colored",
          "That colour was not saved.",
        );
        if (!outcome.ok) {
          toast.error(outcome.message);
        } else {
          logEvent("container.colored", input.orgId, {
            kind: input.kind,
            color: input.color,
            from: "create",
            at_create: true,
            containers_band: containersBand(input.rows.filter((row) => !row.archived_at).length + 1),
          });
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
    return id;
  } catch (e) {
    toast.error((e as Error).message);
    return null;
  }
}
