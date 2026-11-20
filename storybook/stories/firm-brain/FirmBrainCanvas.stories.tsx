// The Firm brain canvas (D-85) on the Kestrel Bay demo firm's real map, as the server would send it to each role:
// with fees for an admin, with no fee record for a manager or analyst. Ask the firm is a stand-in that answers after
// a short wait with lines on St. Brigid, Cedarmere and Willowmere; nothing is sent anywhere.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { FirmBrainCanvasView } from "@/components/firm-brain/FirmBrainCanvas";
import type { FirmAskResult } from "@/lib/firm-ask-shared";
import type { FirmCanvasData } from "@/lib/firm-canvas-shared";

import { AsShipped } from "../proposals/as-shipped";
import kestrel from "./kestrel-canvas.json";

const K = kestrel as unknown as { admin: FirmCanvasData; member: FirmCanvasData; titles: Record<string, string>; ids: Record<"b5" | "b6" | "b7", string> };

function answer(): FirmAskResult {
  const lines: [string, "b5" | "b6" | "b7"][] = [
    ["Give the clinical lead a vote in governance early. It unlocked the St. Brigid design.", "b5"],
    ["Scope the payer contract in the first month. The Cedarmere case waited on it until week 10.", "b6"],
    ["When the case is unproven, start smaller. Willowmere began with an opportunity assessment.", "b7"],
  ];
  const sources: FirmAskResult["sources"] = {};
  const claims = lines.map(([text, board]) => {
    sources[K.ids[board]] = { title: "Statement of work", type: "document", date: null, boardId: board, boardTitle: K.titles[board]!, shownOn: null };
    return { text, itemId: K.ids[board], boardId: board, quote: text, grade: "from_summary" as const };
  });
  return { status: "answered", summary: null, claims, facts: [], nearest: null, read: { full: claims.map((c) => c.itemId), summary: [] }, sources, coverage: "Read 3 of 26 engagements shared with the firm.", oneSource: false };
}

const stand = (ms: number) => () => new Promise<FirmAskResult>((resolve) => setTimeout(() => resolve(answer()), ms));

function Canvas({ role, data }: { role: string; data: FirmCanvasData }) {
  const client = new QueryClient();
  return (
    <AsShipped>
      <QueryClientProvider client={client}>
        <main style={{ height: "100vh" }}>
          <FirmBrainCanvasView profile={{ id: `story-${role}`, role, org_type: "company", has_firm_view: true }} map={{ data, pending: false, failed: false, refused: false, retry: () => {} }} ask={stand(4200)} />
        </main>
      </QueryClientProvider>
    </AsShipped>
  );
}

const meta: Meta = { title: "Firm brain/Canvas", globals: { skin: "charlotte" }, parameters: { layout: "fullscreen" } };
export default meta;
type Story = StoryObj;

export const Admin: Story = { render: () => <Canvas role="admin" data={K.admin} /> };
export const Manager: Story = { render: () => <Canvas role="em" data={K.member} /> };
export const Loading: Story = {
  render: () => (
    <AsShipped>
      <QueryClientProvider client={new QueryClient()}>
        <main style={{ height: "100vh" }}>
          <FirmBrainCanvasView profile={{ id: "story-load", role: "em" }} map={{ data: null, pending: true, failed: false, refused: false, retry: () => {} }} ask={stand(1000)} />
        </main>
      </QueryClientProvider>
    </AsShipped>
  ),
};
