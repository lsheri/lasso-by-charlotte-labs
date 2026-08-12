import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { WatchSuggestion } from "@/lib/connector-watch-shared";
import { isBrowsableToolkit, type BrowsableToolkit } from "@/lib/connector-toolkits";

type WatchInput = {
  profile_id?: string | undefined;
  toolkit: BrowsableToolkit;
  folder_id: string;
  folder_name?: string | undefined;
  watch?: boolean | undefined;
};

function validateWatch(input: WatchInput): WatchInput {
  if (!input || !isBrowsableToolkit(input.toolkit)) throw new Error("Unsupported connector");
  if (!input.folder_id) throw new Error("Pick a folder first.");
  return input;
}

/** Turning a watch on never imports; it only records what is already there. */
export const setFolderWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateWatch)
  .handler(async ({ data, context }): Promise<{ watched: boolean }> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const { setWatch } = await import("@/lib/connector-watch.server");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const result = await setWatch(supabase, {
      profileId: profile.id,
      toolkit: data.toolkit,
      folderId: data.folder_id,
      folderName: data.folder_name ?? "Folder",
      watch: data.watch !== false,
    });

    if (result.watched) {
      const { recordEvent } = await import("@/lib/telemetry.server");
      await recordEvent(supabase, {
        eventType: "connector.watch_enabled",
        orgId: profile.org_id,
        userId,
        dims: { source: data.toolkit },
      });
    }
    return result;
  });

/** Suggestion-only diff of every watched folder. Nothing is ever imported. */
export const checkWatchedFolders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profile_id?: string | undefined } | undefined) => ({
    profile_id: input?.profile_id ?? null,
  }))
  .handler(async ({ data, context }): Promise<{ suggestions: WatchSuggestion[] }> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const { checkWatches } = await import("@/lib/connector-watch.server");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { suggestions: [] };

    const result = await checkWatches(supabase, profile.id).catch(() => ({
      suggestions: [] as WatchSuggestion[],
    }));

    if (result.suggestions.length > 0) {
      const { recordEvent } = await import("@/lib/telemetry.server");
      const { suggestionBucket } = await import("@/lib/connector-watch-shared");
      for (const suggestion of result.suggestions) {
        await recordEvent(supabase, {
          eventType: "connector.suggestion_shown",
          orgId: profile.org_id,
          userId,
          dims: { source: suggestion.source, count: suggestionBucket(suggestion.new_count) },
        });
      }
    }
    return result;
  });

/** Dismiss remembers the ids so they never resurface, still no import. */
export const reviewWatchSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: WatchInput & { action: "opened" | "dismissed" }) => {
    const base = validateWatch(input);
    return { ...base, action: input.action === "opened" ? "opened" : "dismissed" } as const;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    if (data.action === "dismissed") {
      const { dismissWatch } = await import("@/lib/connector-watch.server");
      await dismissWatch(supabase, {
        profileId: profile.id,
        toolkit: data.toolkit,
        folderId: data.folder_id,
      });
    }

    const { recordEvent } = await import("@/lib/telemetry.server");
    await recordEvent(supabase, {
      eventType: "connector.suggestion_reviewed",
      orgId: profile.org_id,
      userId,
      dims: { action: data.action, source: data.toolkit },
    });
    return { ok: true };
  });
