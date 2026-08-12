import { supabase } from "@/integrations/supabase/client";

/**
 * Client side of the streaming chat routes. Deltas arrive as they are written,
 * the final payload comes back once the answer has been persisted server side.
 */
export async function streamChatRequest<T>(
  path: string,
  body: unknown,
  onDelta: (delta: string) => void,
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session expired. Sign in again.");

  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) {
    throw new Error(`That request failed (${response.status}).`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const frame = JSON.parse(line) as
        | { t: "delta"; v: string }
        | { t: "done"; payload: T }
        | { t: "error"; message: string };
      if (frame.t === "delta") onDelta(frame.v);
      else if (frame.t === "error") throw new Error(frame.message);
      else result = frame.payload;
    }
  }

  if (!result) throw new Error("The answer stopped before it finished. Try again.");
  return result;
}
