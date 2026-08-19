import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/analysis/stream")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { authenticateBearer, ndjsonStream } = await import("@/lib/api-auth.server");
        const auth = await authenticateBearer(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const { validateAnalysisInput } = await import("@/lib/analysis.functions");
        const body = validateAnalysisInput(
          (await request.json()) as import("@/lib/analysis-run.server").AnalysisInput,
        );
        return ndjsonStream(async (emit) => {
          const { runAnalysis } = await import("@/lib/analysis-run.server");
          return runAnalysis(auth.supabase, auth.userId, body, (delta) =>
            emit({ t: "delta", v: delta }),
          );
        });
      },
    },
  },
});
