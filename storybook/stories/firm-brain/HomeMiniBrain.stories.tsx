// Home for a lead or a member (D-85 PR B): the greeting, the question box and starters from their latest
// board, with their boards as cards below, on made-up data shaped like Kestrel Bay. Asking in Storybook does nothing
// (there is no Firm brain page to open); the canvas story "Arrived from Home" shows the other end.
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { FirmBrainCanvasView } from "@/components/firm-brain/FirmBrainCanvas";
import { HomeAsk } from "@/components/home/HomeAsk";
import { HomeEngagementGrid } from "@/components/home/HomeEngagementGrid";
import type { FirmAskResult } from "@/lib/firm-ask-shared";
import type { FirmCanvasData } from "@/lib/firm-canvas-shared";
import type { HomeGridEngagement } from "@/lib/home-grid";

import { AsShipped } from "../proposals/as-shipped";
import kestrel from "./kestrel-canvas.json";

function InRouter({ children }: { children: ReactNode }) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <>{children}</> }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return <RouterProvider router={router as never} />;
}

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const BOARDS: HomeGridEngagement[] = [
  {
    id: "b5",
    code: "KB-05",
    title: "Comprehensive weight management service line",
    clientLabel: "St. Brigid Health",
    lastViewedAt: day(0),
    workCount: 14,
  },
  {
    id: "b7",
    code: "KB-07",
    title: "Cardiometabolic service line opportunity",
    clientLabel: "Willowmere Community Health",
    lastViewedAt: day(1),
    workCount: 9,
  },
  {
    id: "b8",
    code: "KB-08",
    title: "At-home infusion patient journey",
    clientLabel: "Veltrona Therapeutics",
    lastViewedAt: day(3),
    workCount: 11,
  },
  {
    id: "b6",
    code: "KB-06",
    title: "Integrated behavioral health service line",
    clientLabel: "Cedarmere Regional Health",
    lastViewedAt: day(6),
    workCount: 12,
  },
];

const K = kestrel as unknown as {
  member: FirmCanvasData;
  titles: Record<string, string>;
  ids: Record<"b5" | "b6" | "b7", string>;
};
function answer(): FirmAskResult {
  const lines: [string, "b5" | "b6" | "b7"][] = [
    ["Recruiting through the clinic hub took longer than planned. Start in week 1.", "b5"],
    ["Ask patients about their last three visits, not the service in general.", "b7"],
  ];
  const sources: FirmAskResult["sources"] = {};
  const claims = lines.map(([text, board]) => {
    sources[K.ids[board]] = {
      title: "Statement of work",
      type: "document",
      date: null,
      boardId: board,
      boardTitle: K.titles[board]!,
      shownOn: null,
    };
    return {
      text,
      itemId: K.ids[board],
      boardId: board,
      quote: text,
      grade: "from_summary" as const,
    };
  });
  return {
    status: "answered",
    summary: null,
    claims,
    facts: [],
    nearest: null,
    read: { full: claims.map((c) => c.itemId), summary: [] },
    sources,
    coverage: "Read 2 of 26 engagements shared with the firm.",
    oneSource: false,
  };
}

function Home({ name, role, data }: { name: string; role: string; data: FirmCanvasData }) {
  const grid = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useLayoutEffect(() => setWidth(grid.current?.clientWidth ?? 900), []);
  return (
    <AsShipped>
      <QueryClientProvider client={new QueryClient()}>
        <InRouter>
          <div className="min-h-screen bg-background px-4 pb-16 pt-10 md:pt-24">
            <div className="mx-auto w-full max-w-[720px]">
              <HomeAsk
                displayName={name}
                role={role}
                recentBoard={BOARDS[0]!.title}
                map={data}
                askFirm={() => new Promise((resolve) => setTimeout(() => resolve(answer()), 3500))}
              />
            </div>
            <div ref={grid} className="mx-auto mt-12 w-full max-w-[930px]">
              <HomeEngagementGrid cards={BOARDS} availableWidth={width} />
            </div>
          </div>
        </InRouter>
      </QueryClientProvider>
    </AsShipped>
  );
}

const meta: Meta = {
  title: "Firm brain/Home",
  globals: { skin: "charlotte" },
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

export const Member: Story = {
  render: () => <Home name="Elif Yilmaz" role="em" data={K.member} />,
};
export const Lead: Story = {
  render: () => <Home name="Signe Lindqvist" role="lead" data={K.admin} />,
};
export const ArrivedFromHome: Story = {
  render: () => (
    <AsShipped>
      <QueryClientProvider client={new QueryClient()}>
        <main style={{ height: "100vh" }}>
          <FirmBrainCanvasView
            profile={{ id: "story-home", role: "em", org_type: "company", has_firm_view: true }}
            map={{ data: K.member, pending: false, failed: false, refused: false, retry: () => {} }}
            ask={() => new Promise((resolve) => setTimeout(() => resolve(answer()), 3500))}
            initialQuestion="What held up patient recruiting last time?"
            onBack={() => {}}
          />
        </main>
      </QueryClientProvider>
    </AsShipped>
  ),
};
