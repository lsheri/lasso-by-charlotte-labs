import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/reflect/stream")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { authenticateBearer, ndjsonStream } = await import("@/lib/api-auth.server");
        const auth = await authenticateBearer(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const raw = (await request.json()) as import("@/lib/reflect-run.server").ReflectInput;
        const { parseScopeSource } = await import("@/lib/reflect-shared");
        const body = { ...raw, scope_source: parseScopeSource(raw.scope_source) };
        return ndjsonStream(async (emit) => {
          const { runReflectTurn } = await import("@/lib/reflect-run.server");
          return runReflectTurn(auth.supabase, auth.userId, body, (delta) =>
            emit({ t: "delta", v: delta }),
          );
        });
      },
    },
  },
});
