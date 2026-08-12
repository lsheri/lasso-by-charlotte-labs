import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SendInput = { session_id: string; message: string; profile_id?: string | undefined };

export const sendReflectMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SendInput) => input)
  .handler(
    async ({
      data,
      context,
    }): Promise<{ answer: string; truncated: boolean; title: string | null }> => {
      const { supabase, userId } = context;
      const message = data.message.trim();
      if (!message) throw new Error("Write something first.");

      const { resolveProfile } = await import("./profile-resolve");
      const profile = await resolveProfile(supabase, userId, data.profile_id);
      if (!profile) throw new Response("Forbidden", { status: 403 });

      const { data: session, error: sessionError } = await supabase
        .from("chat_sessions")
        .select("id, profile_id, title, context_scope")
        .eq("id", data.session_id)
        .maybeSingle();
      if (sessionError) throw new Error(sessionError.message);
      if (!session || session.profile_id !== profile.id) {
        throw new Response("Forbidden", { status: 403 });
      }

      const { parseScope, titleFromMessage, REFLECT_SYSTEM_PROMPT } =
        await import("./reflect-shared");
      const scope = parseScope(session.context_scope);

      const { data: history } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true })
        .limit(40);

      const { assembleReflectContext } = await import("./reflect-context.server");
      const assembled = await assembleReflectContext(supabase, profile.id, scope);

      const apiKey = process.env["LOVABLE_API_KEY"];
      if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

      // gemini-2.5-pro is deliberate: the whole record can be very large.
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          max_tokens: 2000,
          messages: [
            { role: "system", content: REFLECT_SYSTEM_PROMPT },
            {
              role: "system",
              content: `THE PERSON'S RECORDED WORK (scope: ${scope.mode}):\n\n${assembled.context}`,
            },
            ...((history ?? []) as { role: string; content: string }[]).map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            })),
            { role: "user", content: message },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        if (response.status === 429) throw new Error("Rate limited — try again in a moment.");
        if (response.status === 402) throw new Error("AI credits exhausted for this workspace.");
        throw new Error(`AI request failed (${response.status}): ${body.slice(0, 300)}`);
      }

      const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const answer =
        payload.choices?.[0]?.message?.content?.trim() ??
        "I couldn't draw an answer out of that — try asking a different way.";

      const { error: insertError } = await supabase.from("chat_messages").insert([
        { session_id: session.id, role: "user", content: message },
        { session_id: session.id, role: "assistant", content: answer },
      ]);
      if (insertError) throw new Error(insertError.message);

      const title = session.title ?? titleFromMessage(message);
      await supabase
        .from("chat_sessions")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", session.id);

      // Content-free by construction: the scope mode is the only dimension.
      const { recordEvent } = await import("./telemetry.server");
      await recordEvent(supabase, {
        eventType: "reflect.message_sent",
        orgId: profile.org_id,
        userId,
        dims: { scope: scope.mode },
      });

      return { answer, truncated: assembled.truncated, title };
    },
  );
