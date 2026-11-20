// The win strip in a stand-in board shell: the same status column and the same rules from 06-lasso-shell.css, with a
// card where a board's first card sits. The real board page is not rendered here.
import type { Meta, StoryObj } from "@storybook/react-vite";

import { BoardWinLines } from "@/components/proposals/BoardWinLines";
import { Button } from "@/components/ui/button";

import { AsShipped } from "./as-shipped";
import { NOW } from "./kestrel-bay";

function Shell({ alert, offline }: { alert?: boolean; offline?: boolean }) {
  // Where the first card sat on the live won board: centred on a desktop, under the toolbar on a phone.
  const wide = typeof window !== "undefined" && window.innerWidth >= 768;
  return (
    <AsShipped>
      {/* Inline sizes: this is a stand-in for the board's own geometry, not interface styling. */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden" }} className="bg-background">
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: 16,
            width: 240,
            height: 52,
            transform: "translateX(-50%)",
          }}
          className="rounded-(--corner-float) border border-border bg-card shadow-card"
        />
        <div
          data-first-card
          style={{
            position: "absolute",
            left: wide ? 394 : 32,
            top: wide ? 283 : 88,
            width: 260,
            height: 208,
          }}
          className="rounded-(--corner-panel) border border-border bg-card p-3 text-(length:--type-small) text-foreground"
        >
          Harrowgate discovery call notes.docx
        </div>
        <div className="canvas-lab-board-status">
          {/* The page's own order: offline alert, win strip, then save alerts. */}
          {offline ? (
            <div data-testid="board-offline-banner" className="canvas-lab-offline-pill" role="status">
              <p>You are offline. Changes will save when you are back.</p>
            </div>
          ) : null}
          <BoardWinLines
            now={NOW}
            win={{
              won: true,
              decidedAt: "2026-11-19T18:00:00Z",
              leadName: "Corin Ashby",
              ask: {
                name: "Corin Ashby",
                status: "delivered",
                reply: "yes",
                practice: false,
                waiting: false,
              },
            }}
          >
            <Button type="button" size="sm" variant="outline" className="self-start">
              Text the lead
            </Button>
          </BoardWinLines>
          {alert ? (
            <div className="canvas-lab-banner" role="alert">
              <p className="text-(length:--type-body) text-foreground">
                Could not save your last change.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </AsShipped>
  );
}

const meta: Meta = {
  title: "Proposals/Board after a win",
  globals: { skin: "charlotte" },
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

export const WonBoard: Story = { render: () => <Shell /> };
export const WonBoardWithASaveAlert: Story = { render: () => <Shell alert /> };
export const WonBoardOfflineWithASaveAlert: Story = { render: () => <Shell alert offline /> };
