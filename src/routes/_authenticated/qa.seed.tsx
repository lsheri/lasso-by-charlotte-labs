import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { QA_SEED_ORG_ID, seedQaPeople, type QaSeedResult } from "@/lib/qa-seed.functions";

export const Route = createFileRoute("/_authenticated/qa/seed")({
  head: () => ({
    meta: [
      { title: "QA people | Lasso" },
      { name: "description", content: "Internal page for creating QA sign in identities." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "QA people | Lasso" },
      { property: "og:description", content: "Internal page for creating QA sign in identities." },
    ],
  }),
  component: QaSeedPage,
});

function QaSeedPage() {
  const { data: profile } = useProfile();
  const run = useServerFn(seedQaPeople);
  const mutation = useMutation<QaSeedResult, Error, void>({
    mutationFn: () => run({ data: { profile_id: profile?.id } }),
  });

  const allowed = profile?.role === "admin" && profile?.org_id === QA_SEED_ORG_ID;
  if (!allowed) {
    return <p className="p-8 text-sm text-muted-foreground">This page is not for you.</p>;
  }

  return (
    <div className="max-w-xl space-y-4 p-8">
      <h1 className="page-title">QA people</h1>
      <p className="text-sm text-muted-foreground">
        Creates six sign in identities for testing. Nothing else is created, so each one walks the
        real setup.
      </p>
      <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "Working…" : "Create QA people"}
      </Button>
      {mutation.error ? (
        <pre className="whitespace-pre-wrap text-sm text-destructive">
          {mutation.error.message}
        </pre>
      ) : null}
      {mutation.data ? (
        <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">
          {mutation.data.rows
            .map((row) => `${row.email}: ${row.outcome}${row.note ? ` (${row.note})` : ""}`)
            .join("\n")}
        </pre>
      ) : null}
    </div>
  );
}
