// 21 Nov (D-82): the demo tour's Ask beats (1, 3, 7, 8) now play on the Firm brain canvas, since an admin's Home is
// the operating picture. The real tour stage and layout code, a stand-in sidebar of the app's width, and the real
// Kestrel Bay map. Used to check each spotlight lands on its target (the question box, or the Fees chip on beat 3) and
// the card stays off it, at 1440x900, 1280x720 and 390x844. Nothing is sent.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";

import { FirmBrainCanvasView } from "@/components/firm-brain/FirmBrainCanvas";
import { FirmStoryStage } from "@/components/firm-story/FirmStory";
import type { FirmCanvasData } from "@/lib/firm-canvas-shared";
import { storyStorageKey } from "@/lib/firm-story-shared";

import { AsShipped } from "../proposals/as-shipped";
import kestrel from "./kestrel-canvas.json";

const K = kestrel as unknown as { admin: FirmCanvasData };
const PROFILE = "story-tour-admin";

function Page() {
  return (
    <div className="flex min-h-screen" style={{ ["--nav-width" as string]: "256px" }}>
      <aside className="hidden w-[256px] shrink-0 border-r border-border bg-muted md:block" data-testid="stand-in-sidebar" />
      <main className="flex-1">
        <FirmBrainCanvasView
          profile={{ id: PROFILE, role: "admin", org_type: "company", has_firm_view: true }}
          map={{ data: K.admin, pending: false, failed: false, refused: false, retry: () => {} }}
          ask={() => new Promise(() => {})}
        />
      </main>
      <FirmStoryStage profileId={PROFILE} orgId="org-kestrel" window="partner" />
    </div>
  );
}

function Beat({ n }: { n: number }) {
  try {
    window.sessionStorage.setItem(storyStorageKey(PROFILE)!, String(n));
  } catch {
    /* the story still renders */
  }
  const router = createRouter({ routeTree: createRootRoute({ component: Page }), history: createMemoryHistory({ initialEntries: ["/firm-brain"] }) });
  return (
    <AsShipped>
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router as never} />
      </QueryClientProvider>
    </AsShipped>
  );
}

const meta: Meta = { title: "Firm brain/Tour Ask beats", globals: { skin: "charlotte" }, parameters: { layout: "fullscreen" } };
export default meta;
export const Beat1: StoryObj = { render: () => <Beat n={1} /> };
export const Beat3: StoryObj = { render: () => <Beat n={3} /> };
export const Beat7: StoryObj = { render: () => <Beat n={7} /> };
export const Beat8: StoryObj = { render: () => <Beat n={8} /> };
