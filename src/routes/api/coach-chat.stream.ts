import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/coach-chat/stream")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { authenticateBearer, ndjsonStream } = await import("@/lib/api-auth.server");
        const auth = await authenticateBearer(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const raw = await request.json();
        const { validateCoachChat } = await import("@/lib/coach-chat-shared");
        const body = validateCoachChat(raw);
        return ndjsonStream(async (emit) => {
          const { runCoachChat } = await import("@/lib/coach-chat-run.server");
          return runCoachChat(auth.supabase, auth.userId, body, (delta) =>
            emit({ t: "delta", v: delta }),
          );
        });
      },
    },
  },
});
