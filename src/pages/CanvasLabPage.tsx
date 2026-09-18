import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Menu, Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ContextComposer } from "@/components/canvas-lab/ContextComposer";
import { FocusOverlay } from "@/components/canvas-lab/FocusOverlay";
import { LabCard } from "@/components/canvas-lab/LabCard";
import {
  addLocalFrame,
  branchChatNode,
  createChatNode,
  createLabFrames,
  fitScale,
  moveNode,
  removeContext,
  seedCanvas,
  stageBounds,
  toggleContext,
  type LabComment,
  type LabFrame,
  type LabNode,
} from "@/components/canvas-lab/canvas-lab-model";
import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Button } from "@/components/ui/button";
import { useEngagementPage } from "@/hooks/use-engagement-page";
import { useMotion } from "@/hooks/use-motion";
import { useProfile } from "@/hooks/use-profile";
import { dragTo, keyTo, type Point } from "@/lib/canvas-drag";
import { noteCanvasOpenedFn } from "@/lib/canvas.functions";
import { clampZoom, pinchZoom, stepZoom } from "@/lib/canvas-zoom";
import { engagementDisplayTitle } from "@/lib/clients";
import { isDeliverableType } from "@/lib/lineage-shared";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * A local workboard over one permission-filtered engagement read. The board's
 * frames, positions, context, notes, and draft threads disappear on refresh.
 */
export function CanvasLabPage({ engagementId }: { engagementId: string }) {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: page, isLoading, isError } = useEngagementPage(engagementId);
  const noteOpened = useServerFn(noteCanvasOpenedFn);
  const unfold = useMotion("canvas.unfolded");
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

  const taskIdsByWork = useMemo(() => {
    const mapping = new Map<string, string[]>();
    for (const task of page?.tasks ?? []) {
      for (const link of task.work_item_tasks ?? []) {
        const itemId = link.work_items?.id;
        if (!itemId) continue;
        mapping.set(itemId, [...(mapping.get(itemId) ?? []), task.id]);
      }
    }
    return mapping;
  }, [page]);

  const [frames, setFrames] = useState<LabFrame[] | null>(null);
  const [nodes, setNodes] = useState<LabNode[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [comments, setComments] = useState<LabComment[]>([]);
  const [canvasInstructions, setCanvasInstructions] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [keyboardId, setKeyboardId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.72);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [newFrameName, setNewFrameName] = useState("");
  const [opening, setOpening] = useState(true);

  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; origin: Point; from: Point } | null>(null);
  const panRef = useRef<{ from: Point; origin: Point } | null>(null);
  const openedRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpening(false), 520);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!page?.engagement || nodes !== null || frames !== null) return;
    const nextFrames = createLabFrames(page.tasks ?? []);
    const nextNodes = seedCanvas(
      {
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
          typeLabel: item.type.replaceAll("_", " "),
          source: item.source,
          ownedByViewer: !item.owner_id || item.owner_id === profile?.id,
          taskIds: taskIdsByWork.get(item.id) ?? [],
          deliverable: isDeliverableType(item.type),
        })),
        decisions: (page.decisions ?? []).map((decision) => ({
          id: decision.id,
          call: decision.call_text,
          situation: decision.situation,
          ownedByViewer: decision.owner_id === profile?.id,
        })),
      },
      nextFrames,
    );
    setFrames(nextFrames);
    setNodes(nextNodes);
  }, [frames, nodes, page, profile?.id, taskIdsByWork, workItems]);

  const list = nodes ?? [];
  const boardFrames = frames ?? [];
  const bounds = stageBounds(boardFrames);
  const contextNodes = list.filter((node) => selected.includes(node.id));
  const focusNode = list.find((node) => node.id === focusId) ?? null;
  const itemByNode = (node: LabNode) =>
    node.workItemId ? workItems.find((item) => item.id === node.workItemId) : undefined;
  const focusItem = focusNode ? (itemByNode(focusNode) ?? null) : null;

  useEffect(() => {
    if (!nodes || openedRef.current) return;
    openedRef.current = true;
    void noteOpened({
      data: { nodes: nodes.length, links: 0, shelf: 0, profile_id: profile?.id },
    }).catch(() => undefined);
  }, [nodes, noteOpened, profile?.id]);

  const fit = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    setZoom(clampZoom(fitScale(shell.clientWidth, shell.clientHeight, bounds)));
    setPan({ x: 0, y: 0 });
  }, [bounds.height, bounds.width]);

  useEffect(() => {
    fit();
  }, [fit]);

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (focusId) setFocusId(null);
      else if (menuOpen) setMenuOpen(false);
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [focusId, menuOpen]);

  function onCardPointerDown(node: LabNode, event: React.PointerEvent) {
    if (event.button !== 0 || (event.target as Element).closest("button")) return;
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
        const delta = { x: (event.clientX - drag.from.x) / zoom, y: (event.clientY - drag.from.y) / zoom };
        setNodes((current) => (current ? moveNode(current, drag.id, dragTo(drag.origin, delta)) : current));
        return;
      }
      const panning = panRef.current;
      if (panning) {
        setPan({
          x: panning.origin.x + event.clientX - panning.from.x,
          y: panning.origin.y + event.clientY - panning.from.y,
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

  function onCardKeyDown(node: LabNode, event: React.KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelected((current) => toggleContext(current, node.id));
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const to = keyTo({ x: node.x, y: node.y }, event.key, event.shiftKey);
      setNodes((current) => (current ? moveNode(current, node.id, to) : current));
    }
  }

  function branchFrom(node: LabNode) {
    const source = node.kind === "chat" ? node : { ...node, contextIds: [node.id] };
    setNodes((current) => (current ? [...current, branchChatNode(source)] : current));
  }

  function addWorkstream() {
    const name = newFrameName.trim();
    if (!name) return;
    setFrames((current) => addLocalFrame(current ?? [], name));
    setNewFrameName("");
  }

  const title = engagement ? engagementDisplayTitle(engagement) : "Engagement";

  return (
    <div className="fixed inset-0 z-50 flex bg-[var(--nb-paper)]" data-testid="canvas-lab-shell">
      <aside className="z-30 flex w-[52px] shrink-0 flex-col items-center border-r border-border bg-card py-3">
        <LassoLoopMark className="h-7 w-7 text-green" />
        <Button className="mt-5" size="icon" variant="ghost" aria-label="Open workboard menu" onClick={() => setMenuOpen(true)}>
          <Menu className="h-4 w-4" />
        </Button>
        <Button className="mt-auto" size="icon" variant="ghost" aria-label="Back to engagement" asChild>
          <Link to="/engagements/$id" params={{ id: engagementId }}><X className="h-4 w-4" /></Link>
        </Button>
      </aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 flex bg-[var(--nb-scrim)]" onPointerDown={() => setMenuOpen(false)}>
          <aside className="h-full w-[280px] overflow-y-auto border-r border-border bg-sidebar p-4 shadow-[var(--shadow-modal)]" onPointerDown={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <span className="font-serif text-xl text-foreground">Lasso</span>
              <Button size="icon" variant="ghost" aria-label="Close workboard menu" onClick={() => setMenuOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <SidebarNav
              onNavigate={() => setMenuOpen(false)}
              onOpenSettings={() => void navigate({ to: "/settings" })}
            />
            <div className="mt-6 border-t border-border pt-4">
              <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft" htmlFor="canvas-lab-new-frame">Add workstream</label>
              <div className="mt-2 flex gap-2">
                <input id="canvas-lab-new-frame" value={newFrameName} onChange={(event) => setNewFrameName(event.target.value)} className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-input bg-background px-2 text-[12px]" placeholder="Workstream name" />
                <Button size="sm" variant="outline" onClick={addWorkstream}>Add</Button>
              </div>
              <p className="mt-1 font-hand text-[13px] text-[var(--nb-mid)]">not saved</p>
            </div>
          </aside>
        </div>
      ) : null}

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
          <div className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-foreground">{title}</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">Workboard · Not saved</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={fit}>Fit</Button>
            <Button size="icon" variant="ghost" aria-label="Zoom out" onClick={() => setZoom((value) => stepZoom(value, "out"))}><Minus className="h-3.5 w-3.5" /></Button>
            <span className="w-10 text-center font-mono text-[10px] text-soft">{Math.round(zoom * 100)}%</span>
            <Button size="icon" variant="ghost" aria-label="Zoom in" onClick={() => setZoom((value) => stepZoom(value, "in"))}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
        </header>

        <div
          ref={shellRef}
          onPointerDown={(event) => {
            if (event.button === 0) panRef.current = { from: { x: event.clientX, y: event.clientY }, origin: pan };
          }}
          onWheel={(event) => {
            if (event.ctrlKey || event.metaKey) setZoom((current) => pinchZoom(current, event.deltaY));
          }}
          className="canvas-lab-surface relative min-h-0 flex-1 cursor-grab overflow-hidden"
        >
          <div
            data-testid="canvas-lab-stage"
            className="absolute left-0 top-0 origin-top-left"
            style={{ width: bounds.width, height: bounds.height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            {boardFrames.map((frame) => {
              const count = list.filter((node) => node.frame === frame.id).length;
              return (
                <section key={frame.id} style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }} className="absolute rounded-[var(--radius)] border border-dashed border-[var(--nb-pencil)]">
                  <div className="absolute inset-x-3 top-2 flex items-baseline justify-between gap-2">
                    <h2 className="font-hand text-[18px] leading-none text-[var(--nb-mid)]">{frame.name}</h2>
                    <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">{count} {frame.local ? "· local" : ""}</span>
                  </div>
                </section>
              );
            })}

            <svg className="pointer-events-none absolute inset-0 overflow-visible" width={bounds.width} height={bounds.height} aria-hidden="true">
              {list.filter((node) => node.kind === "chat").flatMap((draft) =>
                (draft.contextIds ?? []).map((contextId) => {
                  const source = list.find((node) => node.id === contextId);
                  if (!source) return null;
                  const sx = source.x + 232;
                  const sy = source.y + 54;
                  const tx = draft.x;
                  const ty = draft.y + 54;
                  const middle = (sx + tx) / 2;
                  return <path key={`${draft.id}:${contextId}`} d={`M ${sx} ${sy} C ${middle} ${sy}, ${middle} ${ty}, ${tx} ${ty}`} fill="none" stroke="var(--nb-graphite)" strokeWidth="1.4" strokeDasharray="4 4" strokeLinecap="round" />;
                }),
              )}
            </svg>

            {list.map((node) => (
              <LabCard
                key={node.id}
                node={node}
                item={itemByNode(node)}
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

          {isLoading ? <p className="absolute left-4 top-4 font-hand text-[16px] text-[var(--nb-mid)]">reading the engagement</p> : null}
          {isError ? <p className="absolute left-4 top-4 text-[13px] text-muted-foreground">This workboard could not be opened.</p> : null}
          {!isLoading && !isError && list.length === 0 ? <p className="absolute left-4 top-4 font-hand text-[16px] text-[var(--nb-mid)]">nothing has been brought into this engagement yet</p> : null}

          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <ContextComposer context={contextNodes} onRemoveContext={(id) => setSelected((current) => removeContext(current, id))} onSubmit={(prompt) => setNodes((current) => current ? [...current, createChatNode(prompt, selected)] : current)} canvasInstructions={canvasInstructions} onCanvasInstructions={setCanvasInstructions} />
          </div>

          <div className="pointer-events-none absolute inset-0 grid place-items-center md:hidden">
            <p className="max-w-[260px] bg-card px-4 py-3 text-center text-[13px] leading-[20px] text-muted-foreground shadow-[var(--shadow-card)]">The workboard is easier to arrange on a wider screen. You can still open and read every item here.</p>
          </div>
        </div>

        {opening ? (
          <div className={`pointer-events-none absolute inset-0 z-40 flex ${unfold.className}`} aria-hidden={!unfold.still}>
            {unfold.still ? <span className="sr-only">{unfold.reduced}</span> : null}
            <span className="canvas-lab-unfold-panel" />
            <span className="canvas-lab-unfold-panel" />
            <span className="canvas-lab-unfold-panel" />
          </div>
        ) : null}
      </main>

      {focusNode ? (
        <FocusOverlay
          node={focusNode}
          item={focusItem}
          items={workItems}
          orgId={profile?.org_id}
          profileId={profile?.id}
          viewerName={viewerName}
          comments={comments.filter((comment) => comment.nodeId === focusNode.id)}
          onComment={(comment) => setComments((current) => [...current, comment])}
          onSummarize={() => {
            setNodes((current) => current ? [...current, createChatNode(`Summarize: ${focusNode.title}`, [focusNode.id], { x: focusNode.x + 40, y: focusNode.y + 140 }, focusNode.frame)] : current);
            setFocusId(null);
          }}
          onBranch={() => { branchFrom(focusNode); setFocusId(null); }}
          onClose={() => setFocusId(null)}
        />
      ) : null}
    </div>
  );
}