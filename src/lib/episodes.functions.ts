import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { EpisodeItemRole, EpisodeStatus } from "./telemetry-v2-shared";

export type EpisodeView = {
  id: string;
  title: string;
  objective: string | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  items: {
    work_item_id: string;
    item_role: string;
    title: string;
    type: string;
    source: string;
    source_vendor: string | null;
  }[];
};

function emailOf(claims: unknown): string | null {
  return (claims as { email?: string } | null | undefined)?.email ?? null;
}

function daysBetween(from: string, to: Date): number {
  const start = new Date(from).getTime();
  return Math.max(0, Math.floor((to.getTime() - start) / 86_400_000));
}

/** Called right after a successful mapping. Failure here never fails the map. */
export const syncEpisodeForMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { task_id: string; work_item_ids: string[]; profile_id?: string | undefined }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    try {
      const { resolveProfile } = await import("./profile-resolve");
      const profile = await resolveProfile(supabase, userId, data.profile_id);
      if (!profile) return { ok: false as const };

      const { attachMappedItems } = await import("./episodes.server");
      const result = await attachMappedItems(supabase, {
        taskId: data.task_id,
        ownerId: profile.id,
        orgId: profile.org_id,
        workItemIds: data.work_item_ids,
      });
      if (!result) return { ok: false as const };

      const { recordEventV2 } = await import("./telemetry-v2.server");
      const email = emailOf(context.claims);
      if (result.created) {
        await recordEventV2(supabase, userId, {
          eventName: "episode.created",
          props: { has_task: true, item_count: result.itemCount },
          profileId: profile.id,
          episodeId: result.episode.id,
          email,
        });
      }
      for (const link of result.linked) {
        await recordEventV2(supabase, userId, {
          eventName: "episode.item_linked",
          props: { item_role: link.role as EpisodeItemRole, item_count: result.itemCount },
          profileId: profile.id,
          episodeId: result.episode.id,
          workItemId: link.workItemId,
          email,
        });
      }
      try {
        const { writeEpisodeFact } = await import("./facts.server");
        await writeEpisodeFact(
          { supabase, orgId: profile.org_id, profileId: profile.id },
          result.episode.id,
        );
      } catch (e) {
        console.error("[episodes] episode fact failed:", (e as Error).message);
      }
      return { ok: true as const, episode_id: result.episode.id };
    } catch (e) {
      console.error("[episodes] sync failed:", (e as Error).message);
      return { ok: false as const };
    }
  });

export const detachEpisodeItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_ids: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { detachItems } = await import("./episodes.server");
    await detachItems(context.supabase, data.work_item_ids);
    return { ok: true };
  });

export const episodeForTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { task_id: string }) => input)
  .handler(async ({ data, context }): Promise<EpisodeView | null> => {
    const { supabase } = context;
    const { data: episode } = await supabase
      .from("work_episodes")
      .select("id, title, objective, status, opened_at, closed_at")
      .eq("task_id", data.task_id)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!episode) return null;
    const { data: items } = await supabase
      .from("episode_items")
      .select("work_item_id, item_role, work_items(title, type, source, source_vendor)")
      .eq("episode_id", episode.id);
    return {
      ...(episode as Omit<EpisodeView, "items">),
      items: ((items ?? []) as unknown as {
        work_item_id: string;
        item_role: string;
        work_items: {
          title: string;
          type: string;
          source: string;
          source_vendor: string | null;
        } | null;
      }[]).map((row) => ({
        work_item_id: row.work_item_id,
        item_role: row.item_role,
        title: row.work_items?.title ?? "Untitled",
        type: row.work_items?.type ?? "document",
        source: row.work_items?.source ?? "manual",
        source_vendor: row.work_items?.source_vendor ?? null,
      })),
    };
  });

export const setEpisodeObjective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { episode_id: string; objective: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("work_episodes")
      .update({ objective: data.objective.trim().slice(0, 300) || null })
      .eq("id", data.episode_id);
    if (error) throw new Error("That objective could not be saved. Try again.");
    return { ok: true };
  });

/**
 * Closing is a human declaration. The owner declares for themselves; a coach
 * closing the same piece of work is a manager validation, and that difference
 * is recorded rather than flattened. Reopening runs the same guards and puts
 * the lifecycle back to open without inventing a second outcome.
 */
export const closeEpisode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      episode_id: string;
      status: "open" | "delivered" | "accepted" | "abandoned";
      detail?: string | undefined;
      profile_id?: string | undefined;
    }) => {
      if (!["open", "delivered", "accepted", "abandoned"].includes(input.status)) {
        throw new Error("Unknown close reason.");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { data: episode } = await supabase
      .from("work_episodes")
      .select("id, owner_id, opened_at, status, task_id")
      .eq("id", data.episode_id)
      .maybeSingle();
    if (!episode) throw new Error("That piece of work could not be found.");

    const isOwner = episode.owner_id === profile.id;
    // A coach may only close work they are already allowed to see, and the
    // privileged write happens after that check, never before it.
    let coachMayClose = false;
    if (!isOwner) {
      const { data: allowed } = await supabase.rpc("coaches_subject", {
        subject: episode.owner_id,
      });
      coachMayClose = allowed === true;
      if (!coachMayClose) throw new Response("Forbidden", { status: 403 });
    }

    const now = new Date();
    const writerFor = async () =>
      isOwner ? supabase : (await import("@/integrations/supabase/client.server")).supabaseAdmin;

    if (data.status === "open") {
      const reopenWriter = await writerFor();
      const { error: reopenError } = await reopenWriter
        .from("work_episodes")
        .update({ status: "open" as EpisodeStatus, closed_at: null })
        .eq("id", episode.id);
      if (reopenError) throw new Error("That could not be reopened. Try again.");

      if (episode.task_id) {
        const { taskLifecyclePatch } = await import("./firm-dashboard-shared");
        await reopenWriter
          .from("tasks")
          .update(taskLifecyclePatch("open", now.toISOString()))
          .eq("id", episode.task_id);
      }

      const { episodeItemCount: countForReopen } = await import("./episodes.server");
      const reopenCount = await countForReopen(supabase, episode.id);
      const { recordEventV2: record } = await import("./telemetry-v2.server");
      await record(supabase, userId, {
        eventName: "episode.closed",
        props: {
          status: "open" as EpisodeStatus,
          item_count: reopenCount,
          days_open: daysBetween(episode.opened_at, now),
          reopened: true,
        },
        profileId: profile.id,
        subjectProfileId: episode.owner_id,
        episodeId: episode.id,
        email: emailOf(context.claims),
      });

      const { writeEpisodeFact: writeFact } = await import("./facts.server");
      await writeFact(
        { supabase, orgId: profile.org_id, profileId: episode.owner_id },
        episode.id,
      );
      return { ok: true };
    }

    const outcomeSource = isOwner ? "self_reported" : "manager_validated";
    const outcomeKind =
      data.status === "delivered"
        ? "delivered"
        : data.status === "accepted"
          ? "accepted"
          : "learning_note";

    const writer = isOwner
      ? supabase
      : (await import("@/integrations/supabase/client.server")).supabaseAdmin;

    const { error: updateError } = await writer
      .from("work_episodes")
      .update({ status: data.status as EpisodeStatus, closed_at: now.toISOString() })
      .eq("id", episode.id);
    if (updateError) throw new Error("That could not be closed. Try again.");

    // The same declaration is the deliverable's lifecycle. Firm view counts
    // read from tasks, so the two must never drift apart.
    if (episode.task_id) {
      const { taskLifecyclePatch } = await import("./firm-dashboard-shared");
      const { data: currentTask } = await writer
        .from("tasks")
        .select("delivered_at")
        .eq("id", episode.task_id)
        .maybeSingle();
      const lifecycle =
        data.status === "abandoned"
          ? taskLifecyclePatch("set_aside", now.toISOString())
          : taskLifecyclePatch(
              data.status,
              now.toISOString(),
              currentTask?.delivered_at ?? null,
            );
      await writer.from("tasks").update(lifecycle).eq("id", episode.task_id);
    }

    await writer.from("episode_outcomes").insert({
      episode_id: episode.id,
      kind: outcomeKind,
      detail: data.detail ? data.detail.slice(0, 300) : null,
      outcome_source: outcomeSource,
      observed_at: now.toISOString(),
    });

    const { episodeItemCount } = await import("./episodes.server");
    const itemCount = await episodeItemCount(supabase, episode.id);
    const { recordEventV2 } = await import("./telemetry-v2.server");
    const email = emailOf(context.claims);
    await recordEventV2(supabase, userId, {
      eventName: "episode.closed",
      props: {
        status: data.status as EpisodeStatus,
        item_count: itemCount,
        days_open: daysBetween(episode.opened_at, now),
      },
      profileId: profile.id,
      subjectProfileId: episode.owner_id,
      episodeId: episode.id,
      email,
    });
    await recordEventV2(supabase, userId, {
      eventName: "outcome.declared",
      props: { kind: outcomeKind, outcome_source: outcomeSource, item_count: itemCount },
      profileId: profile.id,
      subjectProfileId: episode.owner_id,
      episodeId: episode.id,
      email,
    });

    // The fact tables carry the same close, keyed pseudonymously, so outcomes
    // can be studied without reading anyone's work.
    const { writeOutcomeFact, writeEpisodeFact } = await import("./facts.server");
    const factCtx = { supabase, orgId: profile.org_id, profileId: episode.owner_id };
    await writeOutcomeFact(factCtx, {
      episodeId: episode.id,
      kind: outcomeKind,
      outcomeSource,
    });
    await writeEpisodeFact(factCtx, episode.id);

    return { ok: true };
  });
