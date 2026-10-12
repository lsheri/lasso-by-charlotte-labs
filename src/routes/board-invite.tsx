import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { SessionHeader } from "@/components/layout/SessionHeader";
import { Button } from "@/components/ui/button";
import { setActiveProfileId } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCEPT_COPY,
  boardInviteReturnPath,
  type BoardInvitePreview,
} from "@/lib/board-invites-shared";
import { claimBoardInvite, previewBoardInvite } from "@/lib/board-invites.functions";

type Search = { code?: string | undefined };

export const Route = createFileRoute("/board-invite")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    code: typeof search["code"] === "string" ? search["code"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Board invite | Lasso" },
      { name: "description", content: "Open a board someone shared with you on Lasso." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Board invite | Lasso" },
      { property: "og:description", content: "Open a board someone shared with you on Lasso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BoardInvitePage,
});

function Card({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-6 py-6 shadow-card">
      <p className="micro-label">Invite</p>
      <h1 className="mt-2 page-title">{title}</h1>
      {children ? <div className="mt-3 space-y-3 text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}

/** Pure card for each preview state; the page supplies the actions. */
export function BoardInviteCard({
  preview,
  code,
  signedIn,
  pending = false,
  error = null,
  onAccept,
  onSignOut,
  onOpenBoard,
}: {
  preview: BoardInvitePreview;
  code: string;
  signedIn: boolean;
  pending?: boolean;
  error?: string | null;
  onAccept?: () => void;
  onSignOut?: () => void;
  onOpenBoard?: () => void;
}) {
  const by = preview.by ?? "Someone";
  const board = preview.board ?? "a board";
  const next = boardInviteReturnPath(code);
  switch (preview.state) {
    case "sent":
      return (
        <Card title={ACCEPT_COPY.heading(by, board)}>
          {signedIn ? (
            <>
              <Button disabled={pending} onClick={onAccept}>{ACCEPT_COPY.accept}</Button>
              {error ? (
                <p role="alert" className="text-foreground">
                  {error}{" "}
                  <button type="button" className="underline" onClick={onSignOut}>{ACCEPT_COPY.signOut}</button>
                </p>
              ) : null}
            </>
          ) : (
            <>
              {preview.email_hint ? <p>{ACCEPT_COPY.useAddress(preview.email_hint)}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/auth" search={{ next }}>{ACCEPT_COPY.signIn}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/auth" search={{ next }}>{ACCEPT_COPY.signUp}</Link>
                </Button>
              </div>
            </>
          )}
        </Card>
      );
    case "pending_approval":
      return <Card title={ACCEPT_COPY.pending} />;
    case "accepted":
      return (
        <Card title={ACCEPT_COPY.accepted}>
          {signedIn && onOpenBoard ? <Button onClick={onOpenBoard}>{ACCEPT_COPY.openBoard}</Button> : null}
        </Card>
      );
    case "expired":
    case "declined":
    case "withdrawn":
      return <Card title={ACCEPT_COPY.closed(by)} />;
    default:
      return <Card title={ACCEPT_COPY.notFound} />;
  }
}

function BoardInvitePage() {
  const { code } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const preview = useServerFn(previewBoardInvite);
  const claim = useServerFn(claimBoardInvite);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewer = useQuery({
    queryKey: ["board-invite-viewer"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const state = useQuery({
    queryKey: ["board-invite-preview", code],
    enabled: Boolean(code),
    queryFn: () => preview({ data: { code: code as string } }),
  });

  async function accept() {
    if (!code) return;
    setPending(true);
    setError(null);
    const result = await claim({ data: { code } }).catch((e: unknown) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : "Could not accept this invite.",
    }));
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    if (result.profileId) await setActiveProfileId(result.profileId);
    if (result.engagementId) {
      navigate({ to: "/engagements/$id/canvas-lab", params: { id: result.engagementId } } as never);
    } else {
      navigate({ to: "/home" });
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut().catch(() => {});
    window.location.replace(`${window.location.origin}${boardInviteReturnPath(code ?? "")}`);
  }

  let body: React.ReactNode;
  if (!code) body = <Card title={ACCEPT_COPY.missing} />;
  else if (state.isLoading || viewer.isLoading || !state.data) body = <Card title={ACCEPT_COPY.loading} />;
  else
    body = (
      <BoardInviteCard
        preview={state.data}
        code={code}
        signedIn={Boolean(viewer.data)}
        pending={pending}
        error={error}
        onAccept={accept}
        onSignOut={signOut}
        onOpenBoard={() => navigate({ to: "/work" } as never)}
      />
    );

  return (
    <>
      <SessionHeader />
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4 pb-16 pt-[calc(4rem+env(safe-area-inset-top))]">
        <div className="w-full max-w-md">{body}</div>
      </main>
    </>
  );
}
