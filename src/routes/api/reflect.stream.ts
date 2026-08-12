import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/reflect/stream")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { authenticateBearer, ndjsonStream } = await import("@/lib/api-auth.server");
        const auth = await authenticateBearer(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json()) as import("@/lib/reflect-run.server").ReflectInput;
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
