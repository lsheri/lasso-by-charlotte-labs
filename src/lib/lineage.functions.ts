import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveProfile } from "@/lib/profile-resolve";
import { isDeliverableType, linkBucket, type LineageStatus } from "@/lib/lineage-shared";

export type EvidenceLink = {
  id: string;
  relation: string;
  rationale: string | null;
  status: LineageStatus;
  item: {
    id: string;
    title: string;
    type: string;
    visibility: string;
    date: string;
    source_vendor: string | null;
    /** Attachment kind only: enough for type identity, nothing else. */
    kind: string | null;
  };
};

export type EvidencePrompt = {
  turn_id: string;
  work_item_id: string;
  thread_title: string;
  turn_no: number;
  ts: string | null;
  content: string;
};

export type DeliverableEvidence = {
  links: EvidenceLink[];
  prompts: EvidencePrompt[];
  vendorVisible: boolean;
  isOwner: boolean;
  versions: { id: string; version_no: number; created_at: string; source_event: string }[];
};

/**
 * What fed this deliverable, read as the caller so row policies decide. The
 * vendor chip obeys orgs.vendor_display for coaches; the owner always sees it.
 */
export const getDeliverableEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_id: string; profile_id?: string | undefined }) => {
    if (!input?.work_item_id) throw new Error("work_item_id is required");
    return { work_item_id: input.work_item_id, profile_id: input.profile_id ?? null };
  })
  .handler(async ({ data, context }): Promise<DeliverableEvidence> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const empty: DeliverableEvidence = {
      links: [],
      prompts: [],
      vendorVisible: true,
      isOwner: false,
      versions: [],
    };

    const { data: deliverable } = await supabase
      .from("work_items")
      .select("id, owner_id, org_id")
      .eq("id", data.work_item_id)
      .maybeSingle();
    if (!deliverable) return empty;

    const isOwner = deliverable.owner_id === profile.id;

    const { data: org } = await supabase
      .from("orgs")
      .select("vendor_display")
      .eq("id", deliverable.org_id)
      .maybeSingle();
    const vendorVisible = isOwner || org?.vendor_display !== "vendor_neutral";

    const { data: linkRows } = await supabase
      .from("work_item_links")
      .select("id, relation, rationale, status, from_item_id, created_at")
      .eq("to_item_id", data.work_item_id)
      .order("created_at", { ascending: true });

    const rows = (linkRows ?? []).filter((row) =>
      isOwner ? row.status !== "discarded" : row.status === "confirmed",
    );

    const fromIds = Array.from(new Set(rows.map((row) => row.from_item_id)));
    const { data: itemRows } = fromIds.length
      ? await supabase
          .from("work_items")
          .select(
            "id, title, type, visibility, work_date, created_at_source, captured_at, source_vendor, source_meta",
          )
          .in("id", fromIds)
      : { data: [] };

    // A source item the caller may not read (private to someone else, or
    // cascaded away) simply drops out of the section.
    const itemFor = new Map((itemRows ?? []).map((item) => [item.id, item]));

    const links: EvidenceLink[] = rows
      .map((row) => {
        const item = itemFor.get(row.from_item_id);
        if (!item) return null;
        return {
          id: row.id,
          relation: row.relation,
          rationale: row.rationale,
          status: row.status as LineageStatus,
          item: {
            id: item.id,
            title: item.title,
            type: item.type as string,
            visibility: item.visibility as string,
            date: item.work_date ?? item.created_at_source ?? item.captured_at,
            source_vendor: vendorVisible ? item.source_vendor : null,
            kind: vendorVisible
              ? (((item.source_meta as { kind?: string } | null)?.kind ?? null) as string | null)
              : null,
          },
        };
      })
      .filter((link): link is EvidenceLink => link !== null);

    // The evidence record: the owner's own prompts, verbatim, from confirmed
    // contributing conversations only.
    const threadIds = links
      .filter((link) => link.status === "confirmed" && link.item.type === "ai_thread")
      .map((link) => link.item.id);

    const { data: turnRows } = threadIds.length
      ? await supabase
          .from("turns")
          .select("id, work_item_id, turn_no, ts, content, role")
          .in("work_item_id", threadIds)
          .eq("role", "user")
          .order("turn_no", { ascending: true })
      : { data: [] };

    const titleFor = new Map(links.map((link) => [link.item.id, link.item.title]));
    const dateFor = new Map(links.map((link) => [link.item.id, link.item.date]));
    const prompts: EvidencePrompt[] = (turnRows ?? [])
      .map((turn) => ({
        turn_id: turn.id,
        work_item_id: turn.work_item_id,
        thread_title: titleFor.get(turn.work_item_id) ?? "Conversation",
        turn_no: turn.turn_no,
        ts: turn.ts ?? dateFor.get(turn.work_item_id) ?? null,
        content: turn.content,
      }))
      .sort((a, b) => (a.ts ?? "").localeCompare(b.ts ?? "") || a.turn_no - b.turn_no);

    const { data: versionRows } = await supabase
      .from("document_versions")
      .select("id, version_no, created_at, source_event")
      .eq("work_item_id", data.work_item_id)
      .order("version_no", { ascending: true });

    return {
      links,
      prompts,
      vendorVisible,
      isOwner,
      versions: (versionRows ?? []).map((row) => ({
        id: row.id,
        version_no: row.version_no,
        created_at: row.created_at,
        source_event: row.source_event,
      })),
    };
  });

/** Owner-only. Drafts links from contributing items to one deliverable. */
export const draftLineage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_id: string; profile_id?: string | undefined }) => {
    if (!input?.work_item_id) throw new Error("work_item_id is required");
    return { work_item_id: input.work_item_id, profile_id: input.profile_id ?? null };
  })
  .handler(
    async ({
      data,
      context,
    }): Promise<{ drafted: number; considered: number; skippedExisting: number }> => {
      const { supabase, userId } = context;
      const profile = await resolveProfile(supabase, userId, data.profile_id);
      if (!profile) throw new Response("Forbidden", { status: 403 });

      const { data: item } = await supabase
        .from("work_items")
        .select("id, owner_id, type")
        .eq("id", data.work_item_id)
        .maybeSingle();
      if (!item || item.owner_id !== profile.id) throw new Response("Forbidden", { status: 403 });
      if (!isDeliverableType(item.type)) {
        throw new Error("Lasso looks for lineage on documents, decks and sheets.");
      }

      const { draftLineageFor } = await import("./lineage.server");
      const result = await draftLineageFor(supabase, {
        deliverableId: item.id,
        ownerId: profile.id,
        orgId: profile.org_id,
        runnerProfileId: profile.id,
        runnerUserId: userId,
        coachMayRun: false,
      });

      const { usageDims } = await import("./ai-usage");
      const { recordEvent } = await import("./telemetry.server");
      await recordEvent(supabase, {
        eventType: "link.drafted",
        orgId: profile.org_id,
        userId,
        dims: {
          count: linkBucket(result.drafted),
          considered: linkBucket(result.considered),
          scope: "item",
          ...usageDims(result.usage ?? { tokensIn: 0, costUsd: 0 }),
        },
      });
      const { recordEventV2 } = await import("./telemetry-v2.server");
      await recordEventV2(supabase, userId, {
        eventName: "lineage.drafted",
        props: { candidate_count: result.considered, scope: "item" },
        profileId: profile.id,
        workItemId: item.id,
      });
      return result;
    },
  );

/** The engagement-level equivalent: every deliverable in one engagement. */
export const draftEngagementLineage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagement_id: string; profile_id?: string | undefined }) => {
    if (!input?.engagement_id) throw new Error("engagement_id is required");
    return { engagement_id: input.engagement_id, profile_id: input.profile_id ?? null };
  })
  .handler(
    async ({
      data,
      context,
    }): Promise<{ drafted: number; deliverables: number; considered: number }> => {
      const { supabase, userId } = context;
      const profile = await resolveProfile(supabase, userId, data.profile_id);
      if (!profile) throw new Response("Forbidden", { status: 403 });

      const { data: tasks } = await supabase
        .from("tasks")
        .select("id")
        .eq("engagement_id", data.engagement_id)
        .eq("owner_id", profile.id);
      const taskIds = (tasks ?? []).map((task) => task.id);
      if (taskIds.length === 0) return { drafted: 0, deliverables: 0, considered: 0 };

      const { data: mapped } = await supabase
        .from("work_item_tasks")
        .select("work_item_id")
        .in("task_id", taskIds);
      const ids = Array.from(new Set((mapped ?? []).map((row) => row.work_item_id)));
      if (ids.length === 0) return { drafted: 0, deliverables: 0, considered: 0 };

      const { data: itemRows } = await supabase
        .from("work_items")
        .select("id, type")
        .in("id", ids)
        .eq("owner_id", profile.id);
      const deliverables = (itemRows ?? []).filter((row) => isDeliverableType(row.type));
      if (deliverables.length === 0) return { drafted: 0, deliverables: 0, considered: 0 };

      const { draftLineageFor } = await import("./lineage.server");
      let drafted = 0;
      let considered = 0;
      let tokensIn = 0;
      let costUsd = 0;
      // Batched deliberately: one deliverable at a time, so a long engagement
      // never sends one enormous request.
      for (const deliverable of deliverables) {
        const result = await draftLineageFor(supabase, {
          deliverableId: deliverable.id,
          ownerId: profile.id,
          orgId: profile.org_id,
          runnerProfileId: profile.id,
          runnerUserId: userId,
          coachMayRun: false,
        });
        drafted += result.drafted;
        considered = Math.max(considered, result.considered);
        tokensIn += result.usage?.tokensIn ?? 0;
        costUsd += result.usage?.costUsd ?? 0;
      }

      const { usageDims } = await import("./ai-usage");
      const { recordEvent } = await import("./telemetry.server");
      await recordEvent(supabase, {
        eventType: "link.drafted",
        orgId: profile.org_id,
        userId,
        dims: {
          count: linkBucket(drafted),
          considered: linkBucket(considered),
          scope: "engagement",
          ...usageDims({ tokensIn, costUsd }),
        },
      });
      return { drafted, deliverables: deliverables.length, considered };
    },
  );

/** Confirm or discard. Discard never deletes: the proposal survives as a record. */
export const reviewLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      link_id: string;
      action: "confirmed" | "discarded";
      profile_id?: string | undefined;
    }) => {
      if (!input?.link_id) throw new Error("link_id is required");
      if (input.action !== "confirmed" && input.action !== "discarded") {
        throw new Error("Unsupported action");
      }
      return { link_id: input.link_id, action: input.action, profile_id: input.profile_id ?? null };
    },
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    // Read the pair before the update so the tools on both ends are known.
    const { data: link } = await supabase
      .from("work_item_links")
      .select("id, relation, from_item_id, to_item_id")
      .eq("id", data.link_id)
      .eq("owner_id", profile.id)
      .maybeSingle();

    const { error } = await supabase
      .from("work_item_links")
      .update({
        status: data.action,
        confirmed_at: data.action === "confirmed" ? new Date().toISOString() : null,
      })
      .eq("id", data.link_id)
      .eq("owner_id", profile.id);
    if (error) throw new Error(error.message);

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabase, {
      eventType: "link.reviewed",
      orgId: profile.org_id,
      userId,
      dims: { action: data.action },
    });

    const { recordEventV2 } = await import("./telemetry-v2.server");
    const relation = link?.relation ?? "informed";
    await recordEventV2(supabase, userId, {
      eventName: data.action === "confirmed" ? "lineage.confirmed" : "lineage.rejected",
      props: { relation },
      profileId: profile.id,
      workItemId: link?.to_item_id ?? null,
    });

    // A confirmed link between two different tools is a handoff, which is the
    // only cross tool evidence in the product that a human has vouched for.
    if (link) {
      const { data: pair } = await supabase
        .from("work_items")
        .select("id, source_vendor, source")
        .in("id", [link.from_item_id, link.to_item_id]);
      const toolOf = (id: string) => {
        const row = (pair ?? []).find((r) => r.id === id);
        return (row?.source_vendor ?? row?.source ?? "unknown").slice(0, 48);
      };
      const fromTool = toolOf(link.from_item_id);
      const toTool = toolOf(link.to_item_id);
      if (fromTool !== toTool) {
        await recordEventV2(supabase, userId, {
          eventName:
            data.action === "confirmed" ? "tool_handoff.confirmed" : "tool_handoff.rejected",
          props: { from_tool: fromTool, to_tool: toTool },
          profileId: profile.id,
        });
        if (data.action === "confirmed") {
          // Pass 167. A person vouched for this pair, so the handoff is
          // observed rather than guessed. Tools and kinds only.
          const { noteHandoffObserved } = await import("./work-taxonomy.server");
          const fromRow = (pair ?? []).find((r) => r.id === link.from_item_id) ?? null;
          const toRow = (pair ?? []).find((r) => r.id === link.to_item_id) ?? null;
          await noteHandoffObserved(
            supabase,
            { orgId: profile.org_id, userId, profileId: profile.id },
            { from: fromRow as never, to: toRow as never },
          );
          const { writeHandoffFact } = await import("./facts.server");
          await writeHandoffFact(
            { supabase, orgId: profile.org_id, profileId: profile.id },
            { fromTool, toTool, method: relation, confirmed: true },
          );
        }
      }
    }
    return { ok: true };
  });
