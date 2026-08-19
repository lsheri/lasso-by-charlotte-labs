import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { SessionHeader } from "@/components/layout/SessionHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/no-access")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "No workspace access | Lasso" },
      { name: "description", content: "Your Lasso workspace access has been turned off." },
      { property: "og:title", content: "No workspace access | Lasso" },
      {
        property: "og:description",
        content: "Your Lasso workspace access has been turned off.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NoAccessPage,
});

function NoAccessPage() {
  const navigate = useNavigate();
  return (
    <>
      <SessionHeader />
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <div className="font-mono text-sm tracking-[0.24em] text-muted-foreground">LASSO</div>
          <h1 className="page-title mt-6">You don&apos;t have access to a workspace right now.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing has been deleted. If this is unexpected, ask an admin of your workspace to
            restore your access.
          </p>
          <Button
            type="button"
            className="mt-6"
            onClick={async () => {
              clearPendingInvite();
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            Sign out
          </Button>
        </div>
      </main>
    </>
  );
}
