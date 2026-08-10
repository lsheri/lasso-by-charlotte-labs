import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Wordmark } from "@/components/layout/Wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setActiveProfileId } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";

type JoinSearch = { code?: string | undefined; eng?: string | undefined };

export const Route = createFileRoute("/join")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): JoinSearch => ({
    code: typeof search["code"] === "string" ? search["code"] : undefined,
    eng: typeof search["eng"] === "string" ? search["eng"] : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      const params = new URLSearchParams();
      if (search.code) params.set("code", search.code);
      if (search.eng) params.set("eng", search.eng);
      throw redirect({ to: "/auth", search: { next: `/join?${params.toString()}` } });
    }
  },
  head: () => ({
    meta: [
      { title: "Accept your invite — Lasso" },
      { name: "description", content: "Join your team's Lasso workspace with an invite link." },
      { property: "og:title", content: "Accept your invite — Lasso" },
      {
        property: "og:description",
        content: "Join your team's Lasso workspace with an invite link.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code, eng } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!code) {
      setError("This link is missing its invite code. Ask for a fresh link.");
      return;
    }
    setPending(true);
    setError(null);

    const { data: profileId, error: joinError } = await supabase.rpc("join_org_with_invite", {
      p_display_name: displayName.trim(),
      p_code: code,
    });

    if (joinError || !profileId) {
      setError(joinError?.message ?? "Could not accept this invite.");
      setPending(false);
      return;
    }

    setActiveProfileId(profileId as string);

    const { data: invite } = await supabase
      .from("invites")
      .select("invited_role, org_id")
      .eq("code", code)
      .maybeSingle();
    const memberRole = invite?.invited_role ?? "coach";

    if (eng) {
      const { error: memberError } = await supabase.from("engagement_members").insert({
        engagement_id: eng,
        profile_id: profileId as string,
        member_role: memberRole,
      });
      if (memberError) {
        setError(memberError.message);
        setPending(false);
        return;
      }
    }

    if (invite?.org_id) logEvent("coach.joined", invite.org_id, { role: memberRole });

    await queryClient.invalidateQueries();
    setPending(false);
    if (eng && memberRole === "coach") {
      const { data: subjects } = await supabase
        .from("engagement_members")
        .select("profile_id")
        .eq("engagement_id", eng)
        .eq("member_role", "em");
      const only = (subjects ?? []).length === 1 ? (subjects ?? [])[0]?.profile_id : undefined;
      if (only) {
        navigate({
          to: "/coaching/$engagementId/$subjectId",
          params: { engagementId: eng, subjectId: only },
          replace: true,
        });
      } else {
        navigate({ to: "/coaching", replace: true });
      }
      return;
    }
    if (eng) navigate({ to: "/engagements/$id", params: { id: eng }, replace: true });
    else if (memberRole === "coach") navigate({ to: "/coaching", replace: true });
    else navigate({ to: "/work", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md">
        <Wordmark size="lg" />
        <div className="mt-8 rounded-[var(--radius)] border border-border bg-card px-6 py-6 shadow-card">
          <h1 className="page-title">Accept your invite</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {eng
              ? "You'll land straight in the engagement you were invited to."
              : "Tell us how your name should appear to your team."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="join-name" className="micro-label">
                Your name
              </Label>
              <Input
                id="join-name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex Rivera"
              />
            </div>
            <Button type="submit" disabled={pending || !displayName.trim()}>
              {pending ? "Joining…" : "Join"}
            </Button>
          </form>

          {error ? (
            <p className="mt-4 rounded-[var(--radius)] border border-border bg-secondary px-4 py-3 text-sm text-foreground">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
