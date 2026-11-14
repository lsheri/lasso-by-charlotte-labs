import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import {
  QA_SEED_ORG_ID,
  resetQaPasswords,
  seedQaPeople,
  type QaResetResult,
  type QaSeedResult,
} from "@/lib/qa-seed.functions";

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
  const { data: profile, isPending } = useProfile();
  const run = useServerFn(seedQaPeople);
  const mutation = useMutation<QaSeedResult, Error, void>({
    mutationFn: () => run({ data: { profile_id: profile?.id } }),
  });
  const runReset = useServerFn(resetQaPasswords);
  const reset = useMutation<QaResetResult, Error, void>({
    mutationFn: () => runReset({ data: { profile_id: profile?.id } }),
  });

  const allowed = profile?.role === "admin" && profile?.org_id === QA_SEED_ORG_ID;
  if (isPending) return null;
  if (!allowed) return <Navigate to="/home" replace />;

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
        <pre className="whitespace-pre-wrap text-sm text-destructive">{mutation.error.message}</pre>
      ) : null}
      {mutation.data ? (
        <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">
          {mutation.data.rows
            .map((row) => `${row.email}: ${row.outcome}${row.note ? ` (${row.note})` : ""}`)
            .join("\n")}
        </pre>
      ) : null}

      <h2 className="pt-6 text-base font-semibold">Reset QA passwords</h2>
      <p className="text-sm text-muted-foreground">
        Sets one new random password on every QA identity and shows it here once. Copy it into the
        Pane secret card so agents can sign in as QA. Real accounts are never touched.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={() => reset.mutate()}
        disabled={reset.isPending}
      >
        {reset.isPending ? "Working…" : "Reset QA passwords"}
      </Button>
      {reset.error ? (
        <pre className="whitespace-pre-wrap text-sm text-destructive">{reset.error.message}</pre>
      ) : null}
      {reset.data ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="qa-new-password">
            New QA password, shown once
          </label>
          <input
            id="qa-new-password"
            readOnly
            value={reset.data.password}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void navigator.clipboard.writeText(reset.data.password)}
          >
            Copy
          </Button>
          <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">
            {reset.data.rows
              .map((row) => `${row.email}: ${row.outcome}${row.note ? ` (${row.note})` : ""}`)
              .join("\n")}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
