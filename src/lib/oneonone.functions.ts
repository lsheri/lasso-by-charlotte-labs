import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveProfile } from "@/lib/profile-resolve";
import { ONEONONE_SYSTEM_PROMPT, windowDim } from "@/lib/oneonone-shared";

export const prepareOneOnOne = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      window_days: number;
      engagement_id?: string | null | undefined;
      profile_id?: string | undefined;
    }) => {
      const days = [7, 14, 30].includes(Number(input?.window_days))
        ? Number(input.window_days)
        : 7;
      return {
        window_days: days,
        engagement_id: input?.engagement_id ?? null,
        profile_id: input?.profile_id ?? null,
      };
    },
  )
  .handler(async ({ data, context }): Promise<{ markdown: string; itemCount: number }> => {
    const { supabase, userId } = context;

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { buildOneOnOneCorpus } = await import("./oneonone.server");
    const corpus = await buildOneOnOneCorpus(
      supabase,
      profile.id,
      data.window_days,
      data.engagement_id,
    );
    if (corpus.itemCount === 0) {
      return {
        markdown: `## What I worked on\n\nNothing was captured in the last ${data.window_days} days, so there is nothing to brief from yet.\n\n## Decisions I made\n\nNo decisions were confirmed in this window.\n\n## Where I want input\n\nNothing open in the record.`,
        itemCount: 0,
      };
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        max_tokens: 1800,
        messages: [
          { role: "system", content: ONEONONE_SYSTEM_PROMPT },
          { role: "user", content: corpus.prompt },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 429) throw new Error("Rate limited. Try again in a moment.");
      if (response.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`AI request failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const markdown = payload.choices?.[0]?.message?.content?.trim();
    if (!markdown) throw new Error("The brief came back empty. Try again.");

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabase, {
      eventType: "oneonone.prepared",
      orgId: profile.org_id,
      userId,
      dims: {
        window: windowDim(data.window_days),
        scope: data.engagement_id ? "engagement" : "overview",
      },
    });

    return { markdown, itemCount: corpus.itemCount };
  });

/** Saves the brief into the person's own Drive, only if they connected one. */
export const saveBriefToDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; markdown: string; profile_id?: string | undefined }) => {
    if (!input?.markdown) throw new Error("markdown is required");
    return {
      title: (input.title || "1:1 brief").slice(0, 120),
      markdown: input.markdown,
      profile_id: input.profile_id ?? null,
    };
  })
  .handler(async ({ data, context }): Promise<{ link: string | null }> => {
    const { supabase, userId } = context;

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { data: account } = await supabase
      .from("connector_accounts")
      .select("id, status")
      .eq("profile_id", profile.id)
      .eq("toolkit", "googledrive")
      .eq("status", "connected")
      .maybeSingle();
    if (!account) throw new Error("No Google Drive is connected to this account.");

    const { createDriveDoc } = await import("./composio.server");
    const result = await createDriveDoc(profile.id, `${data.title}.md`, data.markdown);

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabase, {
      eventType: "oneonone.saved_to_drive",
      orgId: profile.org_id,
      userId,
      dims: {},
    });

    return result;
  });