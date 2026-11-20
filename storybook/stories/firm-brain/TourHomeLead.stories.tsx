// QA H3 (21 Nov): the demo tour's beat 1 on a Lead's Home, which is now the orb Home. The real tour stage and layout
// code, a stand-in sidebar of the app's width, and the real Kestrel Bay map with fees (a Lead sees them). Used to check
// the spotlight lands on the question box (its Ask the firm anchor) and the card stays off it.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

import { FirmStoryStage } from "@/components/firm-story/FirmStory";
import { HomeAsk } from "@/components/home/HomeAsk";
import type { FirmCanvasData } from "@/lib/firm-canvas-shared";
import { storyStorageKey } from "@/lib/firm-story-shared";

import { AsShipped } from "../proposals/as-shipped";
import kestrel from "./kestrel-canvas.json";

const K = kestrel as unknown as { admin: FirmCanvasData };
const PROFILE = "story-tour-lead";

function Page() {
  return (
    <div className="flex min-h-screen" style={{ ["--nav-width" as string]: "256px" }}>
      <aside className="hidden w-[256px] shrink-0 border-r border-border bg-muted md:block" />
      <main className="flex-1 px-4 pb-16 pt-10 md:pt-24">
        <div className="mx-auto w-full max-w-[720px]">
          <HomeAsk
            profileId={PROFILE}
            displayName="Signe Lindqvist"
            role="lead"
            recentBoard="Digital product operating model"
            map={K.admin}
            askFirm={() => new Promise(() => {})}
          />
        </div>
        {/* The boards as cards sit below on the real Home, so the page can scroll as it does there. */}
        <div
          aria-hidden
          className="mx-auto mt-12 w-full max-w-[930px] rounded-[var(--radius-card)] border border-dashed border-border"
          style={{ height: 1100 }}
        />
      </main>
      <FirmStoryStage profileId={PROFILE} orgId="org-kestrel" window="partner" />
    </div>
  );
}

function Beat1() {
  try {
    window.sessionStorage.setItem(storyStorageKey(PROFILE)!, "1");
  } catch {
    /* the story still renders */
  }
  const router = createRouter({
    routeTree: createRootRoute({ component: Page }),
    history: createMemoryHistory({ initialEntries: ["/home"] }),
  });
  return (
    <AsShipped>
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router as never} />
      </QueryClientProvider>
    </AsShipped>
  );
}

const meta: Meta = {
  title: "Firm brain/Tour beat 1 on a Lead's Home",
  globals: { skin: "charlotte" },
  parameters: { layout: "fullscreen" },
};
export default meta;
export const Lead: StoryObj = { render: () => <Beat1 /> };
