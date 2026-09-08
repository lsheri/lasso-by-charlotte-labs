import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ImportResult, PickerPage } from "@/lib/connector-picker-shared";
import { validateProfileId } from "@/lib/connectors-shared";
import { resolveProfile } from "@/lib/profile-resolve";

type StartInput = { profile_id?: string | undefined; redirect_uri: string };
type FinishInput = { profile_id?: string | undefined; code: string; state: string };

function validateStart(input: StartInput): StartInput {
  const uri = (input?.redirect_uri ?? "").trim();
  if (!uri.startsWith("http")) throw new Error("Open this page from the app to connect.");
  return { profile_id: input.profile_id, redirect_uri: uri };
}

function validateFinish(input: FinishInput): FinishInput {
  if (!input?.code || !input?.state) throw new Error("That sign-in did not come back complete.");
  return { profile_id: input.profile_id, code: input.code, state: input.state };
}

/**
 * Step one of connecting Wispr Flow. Wispr will not take a pasted key, so we
 * read where it wants you to sign in, register this app there, and hand back
 * the address to send you to.
 */
export const startWisprConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateStart)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { wisprAuthMeta, savePending, WISPR_MCP_URL } = await import("@/lib/wispr.server");
    const { authorizeUrl, pkcePair, randomToken, registerClient } =
      await import("@/lib/mcp-oauth.server");

    const { resource, issuer, scopes, meta } = await wisprAuthMeta();
    const { clientId } = await registerClient(meta, data.redirect_uri);
    const { verifier, challenge } = await pkcePair();
    const state = randomToken(16);

    await savePending(profile.id, {
      mcpUrl: WISPR_MCP_URL,
      clientId,
      resource,
      issuer,
      verifier,
      state,
      redirectUri: data.redirect_uri,
      scopes,
    });

    return {
      redirect_url: authorizeUrl({
        meta,
        clientId,
        redirectUri: data.redirect_uri,
        challenge,
        state,
        scopes,
        resource,
      }),
    };
  });

/** Step two: the code Wispr sends back becomes the stored connection. */
export const finishWisprConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateFinish)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { readPending, saveCredentials } = await import("@/lib/wispr.server");
    const { discoverAuthServer, exchangeCode } = await import("@/lib/mcp-oauth.server");

    const pending = await readPending(profile.id);
    if (!pending || pending.state !== data.state) {
      throw new Error("That sign-in did not match. Start connecting again.");
    }
    const meta = await discoverAuthServer(pending.issuer);
    const tokens = await exchangeCode({
      meta,
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      verifier: pending.verifier,
      code: data.code,
      resource: pending.resource,
    });
    await saveCredentials(profile.id, {
      mcpUrl: pending.mcpUrl,
      clientId: pending.clientId,
      resource: pending.resource,
      issuer: pending.issuer,
      tokens,
      identity: null,
    });

    const { recordEvent } = await import("@/lib/telemetry.server");
    await recordEvent(supabase, {
      eventType: "connector.enabled",
      orgId: profile.org_id,
      userId,
      dims: { toolkit: "wispr", auth_mode: "oauth" },
    });

    return { status: "connected" as const };
  });

export const getWisprStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProfileId)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });
    const { readCredentials, maskIdentity } = await import("@/lib/wispr.server");
    const creds = await readCredentials(profile.id);
    return {
      status: creds ? ("connected" as const) : ("not_connected" as const),
      identity: creds ? maskIdentity(creds.identity) : null,
    };
  });

export const disconnectWispr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProfileId)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });
    const { forgetWispr } = await import("@/lib/wispr.server");
    await forgetWispr(profile.id);
    return { status: "not_connected" as const };
  });

type BrowseInput = {
  profile_id?: string | undefined;
  search?: string | undefined;
  page_token?: string | undefined;
  page_index?: number | undefined;
};

export const browseWisprMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BrowseInput | undefined): BrowseInput => input ?? {})
  .handler(async ({ data, context }): Promise<PickerPage> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { listWisprMeetings } = await import("@/lib/wispr.server");
    const { importedWisprIds } = await import("@/lib/connector-import.server");
    const { guardConnector } = await import("@/lib/connector-error.server");

    const pageIndex = Number.isFinite(data.page_index) ? Number(data.page_index) : 0;
    const firstPage = !data.page_token && pageIndex === 0;

    /** Machine facts only: never a title, an attendee or a search term. */
    const reportResult = async (dims: {
      tool_chosen: string;
      result_band: string;
      reason: "ok" | "no_tool" | "empty" | "error";
    }) => {
      if (!firstPage) return;
      const { recordEvent } = await import("@/lib/telemetry.server");
      await recordEvent(supabase, {
        eventType: "connector.browse_result",
        orgId: profile.org_id,
        userId,
        dims: { toolkit: "wispr", ...dims },
      });
    };

    return guardConnector(
      supabase,
      { provider: "wispr", orgId: profile.org_id, userId },
      async () => {
        const { resultBand } = await import("@/lib/wispr.server");
        let listed;
        try {
          listed = await listWisprMeetings(profile.id, {
            limit: 30,
            cursor: data.page_token ?? null,
          });
        } catch (error) {
          await reportResult({ tool_chosen: "none", result_band: "0", reason: "error" });
          throw error;
        }
        const { meetings, cursor, unsupported, diagnostics } = listed;
        await reportResult({
          tool_chosen: diagnostics.toolChosen,
          result_band: resultBand(meetings.length),
          reason: unsupported ? "no_tool" : meetings.length === 0 ? "empty" : "ok",
        });
        if (data.page_token && pageIndex > 0) {
          const { recordEvent } = await import("@/lib/telemetry.server");
          await recordEvent(supabase, {
            eventType: "connector.browse_paged",
            orgId: profile.org_id,
            userId,
            dims: { scope: "wispr_meetings", page_index: pageIndex },
          });
        }
        const seen = await importedWisprIds(supabase, profile.id);
        const term = data.search?.trim().toLowerCase();
        return {
          items: meetings
            .filter((m) => !term || m.title.toLowerCase().includes(term))
            .map((m) => ({
              id: m.id,
              title: m.title,
              subtitle:
                m.attendeeCount === null
                  ? null
                  : `${m.attendeeCount} ${m.attendeeCount === 1 ? "person" : "people"}`,
              date: m.date,
              isFolder: false,
              alreadyInLasso: seen.has(m.id),
            })),
          nextPageToken: cursor,
          unsupported:
            unsupported ??
            (meetings.length === 0 && !data.page_token
              ? "No meetings came back yet. Wispr only shares meetings its notetaker joined."
              : null),
        };
      },
    );
  });


export const importWisprMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profile_id?: string | undefined; ids: string[] }) => {
    if (!input || !Array.isArray(input.ids) || input.ids.length === 0) {
      throw new Error("Select at least one meeting first.");
    }
    return { profile_id: input.profile_id, ids: input.ids.slice(0, 100) };
  })
  .handler(async ({ data, context }): Promise<ImportResult> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { fetchWisprMeeting } = await import("@/lib/wispr.server");
    const { importedWisprIds, storeFile, captureEvents } =
      await import("@/lib/connector-import.server");
    const { guardConnector } = await import("@/lib/connector-error.server");

    const guard = { provider: "wispr", orgId: profile.org_id, userId };
    const seen = await importedWisprIds(supabase, profile.id);
    const newIds: string[] = [];
    let imported = 0;
    let skipped = 0;

    for (const id of data.ids) {
      if (seen.has(id)) {
        skipped += 1;
        continue;
      }
      const meeting = await guardConnector(supabase, guard, () =>
        fetchWisprMeeting(profile.id, id),
      );
      if (!meeting) {
        skipped += 1;
        continue;
      }
      const bytes = new TextEncoder().encode(meeting.markdown);
      const path = await storeFile(
        userId,
        `${meeting.title}.md`,
        bytes,
        "text/markdown; charset=utf-8",
      );
      const insert = await supabase
        .from("work_items")
        .insert({
          owner_id: profile.id,
          org_id: profile.org_id,
          type: "call",
          source: "connector:wispr",
          source_vendor: "wispr",
          title: meeting.title,
          visibility: "unmapped",
          content_ref: path,
          content_fidelity: "transcribed",
          ts_precision: meeting.date ? "source" : "capture",
          created_at_source: meeting.date,
          source_meta: { filename: `${meeting.title}.md`, mime_type: "text/markdown" },
          meta: { wispr_id: id },
        })
        .select("id")
        .maybeSingle();
      if (insert.error) throw new Error(insert.error.message);
      if (insert.data?.id) newIds.push(insert.data.id);
      seen.add(id);
      imported += 1;
    }

    const { ensureExtracts } = await import("@/lib/extract.server");
    await ensureExtracts(newIds);

    await captureEvents(supabase, {
      orgId: profile.org_id,
      userId,
      toolkit: "wispr",
      source: "wispr",
      imported,
    });
    return { imported, skipped, updated: 0, unchanged: 0 };
  });
