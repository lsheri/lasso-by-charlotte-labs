// QA H1 (21 Nov): the demo tour's beat 2 over the Firm brain canvas, with the real tour stage and its layout code, a
// stand-in sidebar of the app's width, and the real Kestrel Bay map. Used to measure where the card sits against the
// question box at 1440x900, 1280x720 and 390x844. Nothing is sent: tour events go to a stand-in that refuses.
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

function Beat2() {
  try {
    window.sessionStorage.setItem(storyStorageKey(PROFILE)!, "2");
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

const meta: Meta = { title: "Firm brain/Tour beat 2", globals: { skin: "charlotte" }, parameters: { layout: "fullscreen" } };
export default meta;
export const Admin: StoryObj = { render: () => <Beat2 /> };
