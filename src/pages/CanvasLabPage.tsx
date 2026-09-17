import { Link } from "@tanstack/react-router";
import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ContextComposer } from "@/components/canvas-lab/ContextComposer";
import { FocusOverlay } from "@/components/canvas-lab/FocusOverlay";
import { LabCard } from "@/components/canvas-lab/LabCard";
import { PermissionLegend } from "@/components/canvas-lab/PermissionLegend";
import {
  branchChatNode,
  createChatNode,
  fitScale,
  LAB_FRAMES,
  moveNode,
  removeContext,
  seedCanvas,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  toggleContext,
  type LabComment,
  type LabNode,
} from "@/components/canvas-lab/canvas-lab-model";
import { Button } from "@/components/ui/button";
import { useEngagementPage } from "@/hooks/use-engagement-page";
import { useProfile } from "@/hooks/use-profile";
import { dragTo, keyTo, type Point } from "@/lib/canvas-drag";
import { clampZoom, pinchZoom, stepZoom } from "@/lib/canvas-zoom";
import { engagementDisplayTitle } from "@/lib/clients";
import { cn } from "@/lib/utils";
import type { WorkItemRow } from "@/lib/work-types";

type Mode = "cards" | "live";

/**
 * Canvas Lab: a working surface for one engagement, built to try out a shape,
 * not to keep anything. Real content is read through the ordinary engagement
 * read, which is already filtered to what this person may see. Everything the
 * lab adds, layout included, lives in this browser and goes when the page is
 * refreshed.
 */
export function CanvasLabPage({ engagementId }: { engagementId: string }) {
  const { data: profile } = useProfile();
  const { data: page, isLoading } = useEngagementPage(engagementId);

  const viewerName = profile?.display_name ?? "You";
  const engagement = page?.engagement ?? null;

  const workItems = useMemo(() => {
    const byId = new Map<string, WorkItemRow>();
    for (const task of page?.tasks ?? []) {
      for (const link of task.work_item_tasks ?? []) {
        const item = link.work_items;
        if (item && !byId.has(item.id)) byId.set(item.id, item as WorkItemRow);
      }
    }
    return [...byId.values()];
  }, [page]);

  const [nodes, setNodes] = useState<LabNode[] | null>(null);
  const [mode, setMode] = useState<Mode>("cards");
  const [selected, setSelected] = useState<string[]>([]);
  const [comments, setComments] = useState<LabComment[]>([]);
  const [canvasInstructions, setCanvasInstructions] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [keyboardId, setKeyboardId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.72);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });

  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; origin: Point; from: Point } | null>(null);
  const panRef = useRef<{ from: Point; origin: Point } | null>(null);

  // Seeded once per engagement read. The lab never writes any of this back.
  useEffect(() => {
    if (!page?.engagement || nodes !== null) return;
    const seeded = seedCanvas({
      brief: { title: "The brief", text: page.engagement.brief },
      tasks: (page.tasks ?? []).map((task) => ({
        id: task.id,
        name: task.name,
        detail: task.detail,
        ownedByViewer: task.owner_id === profile?.id,
      })),
      work: workItems.map((item) => ({
        id: item.id,
        title: item.title,
        typeLabel: item.type.replace("_", " "),
        source: item.source,
        ownedByViewer: !item.owner_id || item.owner_id === profile?.id,
        isConversation: item.type === "ai_thread",
      })),
      decisions: (page.decisions ?? []).map((decision) => ({
        id: decision.id,
        call: decision.call_text,
        situation: decision.situation,
        ownedByViewer: decision.owner_id === profile?.id,
      })),
    });
    // One example collaborator object, always labelled as an example so nobody
    // reads it as another person's real work.
    seeded.push({
      id: "example:teammate",
      kind: "chat",
      frame: "conversations",
      title: "Example: a teammate's read of the evidence",
      summary: "Shown to picture how a colleague's work would sit here. Not a real person's work.",
      typeLabel: "example",
      ownership: "teammate",
      example: true,
      x: 1540,
      y: 700,
    });
    setNodes(seeded);
  }, [page, profile?.id, workItems, nodes]);

  const list = nodes ?? [];
  const contextNodes = list.filter((node) => selected.includes(node.id));
  const focusNode = list.find((node) => node.id === focusId) ?? null;
  const focusItem = focusNode?.workItemId
    ? (workItems.find((item) => item.id === focusNode.workItemId) ?? null)
    : null;

  const fit = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    setZoom(clampZoom(fitScale(shell.clientWidth, shell.clientHeight)));
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    fit();
  }, [fit]);

  function onCardPointerDown(node: LabNode, event: React.PointerEvent) {
    if (event.button !== 0) return;
    event.stopPropagation();
    setKeyboardId(node.id);
    dragRef.current = {
      id: node.id,
      origin: { x: node.x, y: node.y },
      from: { x: event.clientX, y: event.clientY },
    };
  }

  useEffect(() => {
    function move(event: PointerEvent) {
      const drag = dragRef.current;
      if (drag) {
        const delta = {
          x: (event.clientX - drag.from.x) / zoom,
          y: (event.clientY - drag.from.y) / zoom,
        };
        setNodes((current) => (current ? moveNode(current, drag.id, dragTo(drag.origin, delta)) : current));
        return;
      }
      const panning = panRef.current;
      if (panning) {
        setPan({
          x: panning.origin.x + (event.clientX - panning.from.x),
          y: panning.origin.y + (event.clientY - panning.from.y),
        });
      }
    }
    function up() {
      dragRef.current = null;
      panRef.current = null;
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [zoom]);

  function onSurfacePointerDown(event: React.PointerEvent) {
    if (event.button !== 0) return;
    panRef.current = { from: { x: event.clientX, y: event.clientY }, origin: pan };
  }

  function onWheel(event: React.WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return;
    setZoom((current) => pinchZoom(current, event.deltaY));
  }

  function onCardKeyDown(node: LabNode, event: React.KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelected((current) => toggleContext(current, node.id));
      return;
    }
    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight"
    ) {
      event.preventDefault();
      const to = keyTo({ x: node.x, y: node.y }, event.key, event.shiftKey);
      setNodes((current) => (current ? moveNode(current, node.id, to) : current));
    }
  }

  function addChat(prompt: string) {
    setNodes((current) => (current ? [...current, createChatNode(prompt, selected)] : current));
  }

  function branchFrom(node: LabNode) {
    const source = node.kind === "chat" ? node : { ...node, contextIds: [node.id] };
    setNodes((current) => (current ? [...current, branchChatNode(source)] : current));
  }

  function summarize(node: LabNode) {
    setNodes((current) =>
      current
        ? [
            ...current,
            {
              ...createChatNode(`Summarize: ${node.title}`, [node.id], {
                x: node.x + 40,
                y: node.y + 140,
              }),
              summary: "Summary asked for locally. The live AI connection is off in this prototype.",
            },
          ]
        : current,
    );
    setFocusId(null);
  }

  const title = engagement ? engagementDisplayTitle(engagement) : "Engagement";

  return (
    <>
      {/* Desktop: a full working surface beside the sidebar. */}
      <div className="fixed inset-0 z-30 hidden flex-col bg-[var(--nb-paper)] md:left-[264px] md:flex">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/engagements/$id"
              params={{ id: engagementId }}
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
            >
              Back to engagement
            </Link>
            <span className="truncate text-[13px] font-medium text-foreground">{title}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
              Canvas Lab
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--nb-yellow-ink)]">
              Not saved
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span
                title={viewerName}
                className="grid h-6 w-6 place-items-center rounded-full border border-[var(--nb-green)] bg-[var(--nb-green-wash)] font-mono text-[10px] uppercase text-[var(--nb-green)]"
              >
                {viewerName.slice(0, 2)}
              </span>
              <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-[var(--nb-pencil)] bg-secondary font-mono text-[9px] uppercase text-soft">
                ex
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                you, plus example presence
              </span>
            </div>

            <div className="flex overflow-hidden rounded-[var(--radius-control)] border border-[var(--nb-pencil)]">
              {(["cards", "live"] as Mode[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={cn(
                    "px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em]",
                    mode === value
                      ? "bg-[var(--nb-ink)] text-[var(--nb-white)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value === "cards" ? "Cards" : "Live"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={fit}>
                Fit view
              </Button>
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => setZoom((z) => stepZoom(z, "out"))}
                className="grid h-7 w-7 place-items-center rounded-[var(--radius-control)] border border-[var(--nb-pencil)] text-muted-foreground hover:text-foreground"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-10 text-center font-mono text-[10px] text-soft">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => setZoom((z) => stepZoom(z, "in"))}
                className="grid h-7 w-7 place-items-center rounded-[var(--radius-control)] border border-[var(--nb-pencil)] text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </header>

        <div
          ref={shellRef}
          onPointerDown={onSurfacePointerDown}
          onWheel={onWheel}
          className="relative min-h-0 flex-1 cursor-grab overflow-hidden"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--nb-rule) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        >
          <div
            data-testid="canvas-lab-stage"
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: STAGE_WIDTH,
              height: STAGE_HEIGHT,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            {LAB_FRAMES.map((frame) => {
              const count = list.filter((node) => node.frame === frame.id).length;
              return (
                <div
                  key={frame.id}
                  style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
                  className="absolute rounded-[var(--radius)] border border-dashed border-[var(--nb-rule)]"
                >
                  <span className="absolute left-3 top-2 font-hand text-[18px] leading-none text-[var(--nb-mid)]">
                    {frame.name}
                  </span>
                  {count === 0 ? (
                    <span className="absolute left-3 top-9 font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                      nothing here yet
                    </span>
                  ) : null}
                </div>
              );
            })}

            {list.map((node) => (
              <LabCard
                key={node.id}
                node={node}
                mode={mode}
                selected={selected.includes(node.id)}
                focused={keyboardId === node.id}
                onSelect={() => setSelected((current) => toggleContext(current, node.id))}
                onOpen={() => setFocusId(node.id)}
                onBranch={() => branchFrom(node)}
                onPointerDown={(event) => onCardPointerDown(node, event)}
                onKeyDown={(event) => onCardKeyDown(node, event)}
              />
            ))}
          </div>

          {isLoading ? (
            <p className="absolute left-4 top-4 font-hand text-[16px] text-[var(--nb-mid)]">
              reading the engagement
            </p>
          ) : null}

          <div className="pointer-events-none absolute right-4 top-4">
            <PermissionLegend />
          </div>

          <div className="pointer-events-none absolute bottom-4 right-4">
            <ContextComposer
              context={contextNodes}
              onRemoveContext={(id) => setSelected((current) => removeContext(current, id))}
              onSubmit={addChat}
              canvasInstructions={canvasInstructions}
              onCanvasInstructions={setCanvasInstructions}
            />
          </div>
        </div>
      </div>

      {/* Narrow screens read the same objects in a column. */}
      <div className="flex flex-col gap-3 md:hidden">
        <h1 className="page-title">Canvas Lab</h1>
        <p className="text-[13px] leading-[20px] text-muted-foreground">
          The canvas works best on a desktop screen. Here is the same material in a list.
        </p>
        <Link
          to="/engagements/$id"
          params={{ id: engagementId }}
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
        >
          Back to engagement
        </Link>
        <ul className="flex flex-col gap-2">
          {list.map((node) => (
            <li
              key={node.id}
              className="rounded-[var(--radius-control)] border border-[var(--nb-pencil)] bg-card px-3 py-2.5"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                {node.typeLabel}
              </span>
              <p className="text-[13px] font-medium text-foreground">{node.title}</p>
              <p className="text-[11.5px] leading-[17px] text-muted-foreground">{node.summary}</p>
            </li>
          ))}
        </ul>
      </div>

      {focusNode ? (
        <FocusOverlay
          node={focusNode}
          item={focusItem}
          viewerName={viewerName}
          comments={comments.filter((comment) => comment.nodeId === focusNode.id)}
          onComment={(comment) => setComments((current) => [...current, comment])}
          onSummarize={() => summarize(focusNode)}
          onBranch={() => {
            branchFrom(focusNode);
            setFocusId(null);
          }}
          onClose={() => setFocusId(null)}
        />
      ) : null}
    </>
  );
}
