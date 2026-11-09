import { openInNewTab } from "@/lib/open-tab";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight } from "lucide-react";

import { BrandLogo } from "@/components/connectors/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { BRANCH_TARGETS, BRANCH_TOOLS } from "@/lib/branch-targets";
import {
  H7_CHOICES,
  handoffRoute,
  packageHandoff,
  pickHandoffTool,
  readAskedTool,
  writeAskedTool,
  type H7Choice,
  type H7Input,
  type H7Route,
  type H7Signals,
  type H7Tool,
} from "@/lib/ask-handoff";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function safeStore(): Store | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const H7_COPY = {
  which: "Which AI do you use?",
  hint: {
    connector: (label: string) => `Opened ${label}. It reads the board through Lasso.`,
    link: (label: string) => `Opened ${label} with this filled in.`,
    clipboard: (label: string) => `Too long for a link, so it is copied. In ${label}, paste it into the new chat and send.`,
    file: (label: string) => `Saved as a file. Drop it into ${label} to carry on.`,
    blocked: "Pop-up blocked. It is on your clipboard.",
  },
};

/** H7f: how long the hint stays. A paste or a file needs the person to act, so it stays long enough to read. */
export function hintMs(route: H7Route | "blocked"): number {
  return route === "link" || route === "connector" ? 2500 : 8000;
}

/**
 * H7 signals, read once per board for this person: pushes of this board's work,
 * this person's pushes, live connections. Small reads, never the work itself.
 * A failed read leaves the signal empty and the person is asked once.
 */
export function useHandoffSignals({
  profileId,
  itemIds,
  enabled,
}: {
  profileId: string;
  itemIds: string[];
  enabled: boolean;
}) {
  const [signals, setSignals] = useState<(Omit<H7Signals, "asked"> & { signin: boolean }) | null>(
    null,
  );
  const idsKey = itemIds.slice(0, 300).join(",");
  useEffect(() => {
    if (!enabled || !profileId) return;
    let live = true;
    const ids = idsKey ? idsKey.split(",") : [];
    void Promise.all([
      ids.length > 0
        ? supabase
            .from("work_item_pushes")
            .select("source_vendor, pushed_at")
            .in("work_item_id", ids)
            .order("pushed_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("work_item_pushes")
        .select("source_vendor, work_items!inner(owner_id)")
        .eq("work_items.owner_id", profileId)
        .limit(500),
      supabase
        .from("mcp_connections")
        .select("client_name, kind")
        .eq("profile_id", profileId)
        .is("revoked_at", null)
        .limit(20),
    ]).then(
      ([board, mine, conns]) => {
        if (!live) return;
        const connections = ((conns.error ? [] : conns.data) ?? []) as {
          client_name: string | null;
          kind: string | null;
        }[];
        setSignals({
          boardPushes: (
            ((board.error ? [] : board.data) ?? []) as {
              source_vendor: string | null;
              pushed_at: string;
            }[]
          ).map((r) => ({ vendor: r.source_vendor, at: r.pushed_at })),
          myPushes: (
            ((mine.error ? [] : mine.data) ?? []) as { source_vendor: string | null }[]
          ).map((r) => ({ vendor: r.source_vendor })),
          connected: connections.map((c) => c.client_name),
          signin: connections.some((c) => c.kind === "signin"),
        });
      },
      () => {
        if (live) setSignals({ boardPushes: [], myPushes: [], connected: [], signin: false });
      },
    );
    return () => {
      live = false;
    };
  }, [enabled, profileId, idsKey]);
  return signals;
}

/**
 * H7d: where the menu goes. It opens up from the button, right edges aligned. If the Continue line
 * sits above the button and overlaps it sideways, the menu opens above the line instead, so the
 * line's words stay readable. Never closer than 8 px to the viewport edge; the menu scrolls if short of room.
 */
export function menuPlacement(
  button: { top: number; right: number },
  line: { top: number; bottom: number; left: number; right: number } | null,
  viewport: { width: number; height: number },
): { right: number; bottom: number; maxHeight: number } {
  let anchorTop = button.top;
  // Above the line only when there is room for the menu there; otherwise covering the line beats leaving the screen.
  if (line && line.bottom <= button.top + 1 && line.right > button.right - 256 && line.left < button.right && line.top - 16 >= 140) anchorTop = Math.min(anchorTop, line.top);
  const bottom = Math.max(8, viewport.height - anchorTop + 8);
  return { right: Math.max(8, viewport.width - button.right), bottom, maxHeight: Math.max(120, viewport.height - bottom - 8) };
}

/** Carries out one hand-off on the person's click. Returns the route taken. */
export async function carryOut(
  tool: H7Tool,
  input: Omit<H7Input, "viaConnector">,
  viaConnector: boolean,
): Promise<{ route: H7Route; blocked: boolean }> {
  const text = packageHandoff({ ...input, viaConnector });
  const { route, url } = handoffRoute(tool, text, viaConnector);
  if (route === "file") {
    const blob = new Blob([text], { type: "text/markdown" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${input.boardTitle.replace(/[^\p{L}\p{N} _-]+/gu, "").trim() || "lasso"} - for ${BRANCH_TARGETS[tool].label}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1_000);
  }
  if (route === "clipboard") {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* Carry on without the clipboard. */
    }
  }
  const opened = openInNewTab(url);
  if (!opened && route !== "clipboard") {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* nothing more to try */
    }
  }
  return { route, blocked: !opened };
}

/**
 * H7 (ask-v2): one button. The AI comes from pushes (or is asked once); the
 * menu offers three things to carry, default first. Nothing is put together
 * until a choice is clicked.
 */
export function ContinueInAI({
  profileId,
  disabled,
  signals,
  build,
  onDone,
}: {
  profileId: string;
  disabled: boolean;
  signals: (Omit<H7Signals, "asked"> & { signin: boolean }) | null;
  /** Called only on a click, to read what to carry from the current chat. */
  build: () => Omit<H7Input, "viaConnector" | "choice">;
  onDone: (route: H7Route, blocked: boolean, label: string, choice: H7Choice) => void;
}) {
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState<H7Tool | null>(() => readAskedTool(profileId, safeStore()));
  const tool = pickHandoffTool({
    ...(signals ?? { boardPushes: [], myPushes: [], connected: [] }),
    asked,
  });
  const label = tool ? BRANCH_TARGETS[tool].label : "your AI";
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // H7b: the Ask panel clips its overflow, so the menu is placed over the page at the button's position.
  const [place, setPlace] = useState<CSSProperties | null>(null);
  useEffect(() => {
    if (!open || !box.current) {
      setPlace(null);
      return;
    }
    const rect = box.current.getBoundingClientRect();
    // H7d: when the Continue line shows above the composer, open above it rather than over it.
    const line = box.current.closest(".ask-draft")?.querySelector<HTMLElement>('[data-testid="h7-line"]') ?? null;
    setPlace({ position: "fixed", zIndex: 80, ...menuPlacement(rect, line?.getBoundingClientRect() ?? null, { width: window.innerWidth, height: window.innerHeight }) });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (box.current?.contains(event.target) || menu.current?.contains(event.target)) return;
      setOpen(false);
    };
    // H7e: Escape closes the menu, and only the menu: caught before the board's own Escape (which clears
    // picked cards) can see it, and focus goes back to the button that opened it.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);

  async function go(choice: H7Choice, chosen: H7Tool) {
    setOpen(false);
    const viaConnector = Boolean(signals?.signin) && chosen !== "gemini";
    const result = await carryOut(chosen, { ...build(), choice }, viaConnector);
    onDone(result.route, result.blocked, BRANCH_TARGETS[chosen].label, choice);
  }

  return (
    <div ref={box} className="relative inline-flex" data-testid="continue-in-ai">
      <button
        ref={trigger}
        type="button"
        className="ask-draft-send-aside"
        aria-label={`Continue in ${label}`}
        title={`Continue in ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {tool ? <BrandLogo brand={tool === "chatgpt" ? "chatgpt" : tool} size={18} /> : null}
        <ArrowUpRight size={14} aria-hidden="true" />
      </button>
      {open && place ? createPortal(
        <div
          ref={menu}
          role="menu"
          style={place}
          className="w-64 overflow-y-auto rounded-[var(--radius-control)] border border-border bg-background p-1 text-[13px] shadow-sm"
          data-testid="continue-menu"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {tool ? (
            <>
              <p className="px-2 py-1 text-[12px] text-muted-foreground">
                Continue in {label} with
              </p>
              {H7_CHOICES.map((choice, index) => (
                <button
                  key={choice.id}
                  type="button"
                  role="menuitem"
                  data-choice={choice.id}
                  data-default={index === 0 ? "true" : undefined}
                  className={`flex w-full items-center rounded-[var(--radius-control)] px-2 py-1.5 text-left hover:bg-muted ${index === 0 ? "font-medium" : ""}`}
                  onClick={() => void go(choice.id, tool)}
                >
                  {choice.label}
                </button>
              ))}
            </>
          ) : (
            <>
              <p className="px-2 py-1 text-[12px] text-muted-foreground">{H7_COPY.which}</p>
              {BRANCH_TOOLS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="menuitem"
                  data-tool={option}
                  className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2 py-1.5 text-left hover:bg-muted"
                  onClick={() => {
                    writeAskedTool(profileId, option, safeStore());
                    setAsked(option);
                  }}
                >
                  <BrandLogo brand={option} size={16} />
                  {BRANCH_TARGETS[option].label}
                </button>
              ))}
            </>
          )}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
