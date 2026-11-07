import { createFileRoute } from "@tanstack/react-router";

/**
 * TOTAL-5: warm the model cache for a read set before the question is typed.
 * Same auth as the stream route; returns counts only, never content.
 */
export const Route = createFileRoute("/api/reflect/prime")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { authenticateBearer } = await import("@/lib/api-auth.server");
        const auth = await authenticateBearer(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json()) as import("@/lib/reflect-run.server").PrimeInput;
        const { primeReflectContext } = await import("@/lib/reflect-run.server");
        try {
          const result = await primeReflectContext(auth.supabase, auth.userId, body);
          return Response.json(result);
        } catch (e) {
          if (e instanceof Response) return e;
          return Response.json({ primed: false, reason: "error" }, { status: 200 });
        }
      },
    },
  },
});
