import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { WorkstreamColumnHeader } from "@/components/engagements/WorkstreamColumnHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TypeIcon } from "@/components/work/TypeIcon";
import { orderElements, type WorkflowElement } from "@/components/work/TaskWorkflow";
import { supabase } from "@/integrations/supabase/client";
import { detachEpisodeItems, syncEpisodeForMapping } from "@/lib/episodes.functions";
import {
  announceCancel,
  announceDrop,
  announceGrab,
  announceMove,
  correctSameColumn,
  indexByMidpoint,
  keyboardTarget,
  moveCard,
  samePos,
  type CanvasPos,
  type MoveColumn,
} from "@/lib/canvas-move";
import { workIdentityLabel } from "@/lib/work-identity";
import { persistOrder, remapItems, resetOrder } from "@/lib/workflow-order";
import { effectiveWorkDate, formatDate, sourceLabel, type WorkItemRow } from "@/lib/work-types";

export type CanvasTask = {
  id: string;
  name: string;
  owner_id: string;
  detail: string | null;
  work_item_tasks: {
    step_no: number | null;
    step_confirmed: boolean;
    work_items: WorkflowElement["work_items"] | null;
  }[];
};

const SLOP = 6;
const HOLD_MS = 300;

function elementsOf(task: CanvasTask): WorkflowElement[] {
  return task.work_item_tasks
    .filter((link) => link.work_items !== null)
    .map((link) => ({
      step_no: link.step_no,
      step_confirmed: link.step_confirmed,
      work_items: { ...link.work_items!, work_item_tasks: [] },
    }));
}

/**
 * The engagement canvas: workstreams as open columns on quad paper, the work
 * inside them as white cards. Three ways to move a card, one way to write it:
 * the shared order helpers. Nothing here invents a new write or a new event.
 */
export function EngagementCanvas({
  engagementId,
  tasks,
  profile,
  onChanged,
  onOpen,
}: {
  engagementId: string;
  tasks: CanvasTask[];
  profile: { id: string; org_id: string; role: string } | null | undefined;
  onChanged: () => Promise<void> | void;
  onOpen: (item: WorkItemRow) => void;
}) {
  const queryClient = useQueryClient();
  const syncEpisode = useServerFn(syncEpisodeForMapping);
  const detachEpisode = useServerFn(detachEpisodeItems);

  const [taskName, setTaskName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState("");
  const [local, setLocal] = useState<MoveColumn[] | null>(null);
  const [grabbed, setGrabbed] = useState<{ id: string; pos: CanvasPos } | null>(null);
  const [drag, setDrag] = useState<
    { id: string; from: CanvasPos; x: number; y: number; width: number } | null
  >(null);
  const [dropCol, setDropCol] = useState<number | null>(null);
  const [moveSheet, setMoveSheet] = useState<{ id: string; from: CanvasPos } | null>(null);
  const [page, setPage] = useState(0);
  // Bumped on every pointerdown that could become a drag; the window listeners
  // are keyed on it so tracking survives the pointer leaving the canvas.
  const [gesture, setGesture] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const holdRef = useRef<number | null>(null);
  const startRef = useRef<{
    x: number;
    y: number;
    lifted: boolean;
    touch: boolean;
    pos: CanvasPos;
    id: string;
    width: number;
  } | null>(null);
  /**
   * True from the moment a gesture stops being a plain click: a lift, or the
   * hold timer opening the move sheet. The click that the browser dispatches
   * afterwards checks and clears this instead of reading startRef, which is
   * already null by then.
   */
  const movedRef = useRef(false);
  const dragRef = useRef<typeof drag>(null);
  const focusAfter = useRef<string | null>(null);


  const canEdit = Boolean(profile && profile.role !== "coach");

  const cards = useMemo(() => {
    const map = new Map<string, WorkflowElement>();
    for (const task of tasks) for (const element of elementsOf(task)) map.set(element.work_items.id, element);
    return map;
  }, [tasks]);

  const columns = useMemo<MoveColumn[]>(
    () =>
      tasks.map((task) => {
        const { placed, unplaced } = orderElements(elementsOf(task));
        return {
          id: task.id,
          name: task.name,
          cardIds: [...placed, ...unplaced].map((element) => element.work_items.id),
        };
      }),
    [tasks],
  );

  // Server truth wins the moment it arrives, unless a card is in the hand.
  useEffect(() => {
    if (!grabbed && !drag) setLocal(null);
  }, [columns, grabbed, drag]);

  const view = local ?? columns;

  useEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    cardRefs.current.get(id)?.focus();
  }, [view]);

  const confirmedByTask = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const task of tasks) map.set(task.id, orderElements(elementsOf(task)).confirmed);
    return map;
  }, [tasks]);

  const invalidate = useCallback(
    (queryKey: readonly unknown[]) => queryClient.invalidateQueries({ queryKey: [...queryKey] }),
    [queryClient],
  );

  const refreshTasks = useCallback(async () => {
    await onChanged();
  }, [onChanged]);

  /** The single write path for every gesture. */
  async function commit(next: MoveColumn[], from: CanvasPos, to: CanvasPos, cardId: string) {
    const target = next[to.col];
    const source = columns[from.col];
    if (!target || !source || !profile) return;
    setBusy(true);
    setError(null);
    setLocal(next);
    try {
      if (from.col !== to.col) {
        const element = cards.get(cardId);
        if (!element) return;
        const item = element.work_items;
        const remap = await remapItems({
          targets: [{ id: item.id, type: item.type, source: item.source }],
          taskId: target.id,
          profile: { id: profile.id, org_id: profile.org_id },
          detachEpisode: detachEpisode as never,
          syncEpisode: syncEpisode as never,
          invalidate,
        });
        if (remap.error) {
          setError(remap.error);
          setLocal(null);
          return;
        }
        // A placement into a column that already holds work is a sequence
        // decision, exactly as a manual reorder is. An empty column is not.
        if (target.cardIds.length > 1) {
          const result = await persistOrder({
            taskId: target.id,
            workItemIds: target.cardIds,
            orgId: profile.org_id,
            onChanged: refreshTasks,
          });
          if (result.error) setError(result.error);
        } else {
          await refreshTasks();
        }
      } else {
        const result = await persistOrder({
          taskId: target.id,
          workItemIds: target.cardIds,
          orgId: profile.org_id,
          onChanged: refreshTasks,
        });
        if (result.error) setError(result.error);
      }
    } finally {
      setLocal(null);
      setBusy(false);
    }
  }

  function applyMove(from: CanvasPos, to: CanvasPos, cardId: string, announce = true) {
    if (samePos(from, to)) return;
    const { cols, pos } = moveCard(view, from, to);
    if (announce) {
      const title = cards.get(cardId)?.work_items.title ?? "Card";
      setLive(announceMove(title, cols[pos.col]?.name ?? "", pos.index));
    }
    void commit(cols, from, pos, cardId);
  }

  async function onReset(taskId: string) {
    if (!profile) return;
    setBusy(true);
    const result = await resetOrder({ taskId, orgId: profile.org_id, onChanged: refreshTasks });
    if (result.error) setError(result.error);
    setBusy(false);
  }

  // ── Pointer ───────────────────────────────────────────────────────────────

  function placeAt(clientX: number, clientY: number, from: CanvasPos): CanvasPos {
    let col = from.col;
    colRefs.current.forEach((node, index) => {
      if (!node) return;
      const box = node.getBoundingClientRect();
      if (clientX >= box.left && clientX <= box.right) col = index;
    });
    const target = view[col];
    if (!target) return from;
    const midpoints = target.cardIds
      .filter((id) => !(col === from.col && id === target.cardIds[from.index]))
      .map((id) => {
        const box = cardRefs.current.get(id)?.getBoundingClientRect();
        return box ? box.top + box.height / 2 : Number.POSITIVE_INFINITY;
      });
    const index = indexByMidpoint(midpoints, clientY);
    return correctSameColumn(from, { col, index: col === from.col ? index + (index >= from.index ? 1 : 0) : index });
  }

  /** The card leaves the page and enters the hand. One place, every path. */
  function lift(start: NonNullable<typeof startRef.current>, x: number, y: number) {
    startRef.current = { ...start, lifted: true };
    movedRef.current = true;
    const next = { id: start.id, from: start.pos, x, y, width: start.width };
    dragRef.current = next;
    setDrag(next);
    setDropCol(start.pos.col);
    setLive(announceGrab(cards.get(start.id)?.work_items.title ?? "Card"));
  }

  function beginPointer(
    event: React.PointerEvent,
    pos: CanvasPos,
    id: string,
    fromHandle: boolean,
  ) {
    if (!canEdit || busy) return;
    const touch = event.pointerType !== "mouse";
    if (!touch && event.button !== 0) return;
    movedRef.current = false;
    const width = cardRefs.current.get(id)?.getBoundingClientRect().width ?? 240;
    const start = { x: event.clientX, y: event.clientY, lifted: false, touch, pos, id, width };
    startRef.current = start;
    setGesture((n) => n + 1);

    if (touch && fromHandle) {
      lift(start, event.clientX, event.clientY);
    } else if (touch) {
      holdRef.current = window.setTimeout(() => {
        holdRef.current = null;
        // The sheet is a move, not a click: the tap that follows must not peek.
        movedRef.current = true;
        setMoveSheet({ id, from: pos });
      }, HOLD_MS);
    }
  }

  function movePointer(event: { clientX: number; clientY: number }) {
    const start = startRef.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (holdRef.current !== null && Math.hypot(dx, dy) > SLOP) {
      window.clearTimeout(holdRef.current);
      holdRef.current = null;
      startRef.current = null;
      return;
    }
    if (!start.lifted) {
      // Touch never lifts on movement alone: the handle lifts, the hold opens
      // the sheet, and a plain drag on the body is the page scrolling.
      if (start.touch) return;
      if (Math.hypot(dx, dy) < SLOP) return;
      lift(start, event.clientX, event.clientY);
    }
    if (start.touch && Math.abs(dx) > Math.abs(dy)) {
      endPointer(true);
      return;
    }
    const from = startRef.current?.pos ?? start.pos;
    const next = { id: start.id, from, x: event.clientX, y: event.clientY, width: start.width };
    dragRef.current = next;
    setDrag(next);
    setDropCol(placeAt(event.clientX, event.clientY, from).col);
  }

  function endPointer(cancel = false) {
    if (holdRef.current !== null) {
      window.clearTimeout(holdRef.current);
      holdRef.current = null;
    }
    const current = dragRef.current;
    startRef.current = null;
    dragRef.current = null;
    setDrag(null);
    setDropCol(null);
    if (!current) return;
    if (cancel) {
      setLive(announceCancel(cards.get(current.id)?.work_items.title ?? "Card"));
      return;
    }
    const to = placeAt(current.x, current.y, current.from);
    setLive(announceDrop(cards.get(current.id)?.work_items.title ?? "Card"));
    applyMove(current.from, to, current.id, false);
  }

  /**
   * The drag belongs to the window, not to the scroll container: a pointer that
   * wanders off the canvas keeps tracking, and a release anywhere still ends it.
   */
  const gestureHandlers = useRef({ move: movePointer, end: endPointer });
  gestureHandlers.current = { move: movePointer, end: endPointer };

  useEffect(() => {
    if (gesture === 0) return;
    const onMove = (event: PointerEvent) => {
      if (startRef.current?.lifted) event.preventDefault();
      gestureHandlers.current.move(event);
    };
    const onUp = () => gestureHandlers.current.end(false);
    const onCancel = () => gestureHandlers.current.end(true);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [gesture]);


  // ── Keyboard ──────────────────────────────────────────────────────────────

  function onCardKeyDown(event: React.KeyboardEvent, pos: CanvasPos, id: string) {
    const title = cards.get(id)?.work_items.title ?? "Card";
    if (event.key === "Enter") {
      const item = cards.get(id)?.work_items;
      if (item) onOpen(item);
      return;
    }
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      if (!canEdit) return;
      if (!grabbed) {
        setGrabbed({ id, pos });
        setLive(announceGrab(title));
        return;
      }
      const from = columns.findIndex((col) => col.cardIds.includes(id));
      const start: CanvasPos = { col: from, index: columns[from]?.cardIds.indexOf(id) ?? 0 };
      setGrabbed(null);
      setLive(announceDrop(title));
      if (!samePos(start, grabbed.pos)) {
        void commit(view, start, grabbed.pos, id);
      } else {
        setLocal(null);
      }
      return;
    }
    if (event.key === "Escape" && grabbed) {
      event.preventDefault();
      setGrabbed(null);
      setLocal(null);
      setLive(announceCancel(title));
      return;
    }
    if (event.key.startsWith("Arrow") && grabbed && grabbed.id === id) {
      const to = keyboardTarget(view, grabbed.pos, event.key);
      if (!to) return;
      event.preventDefault();
      const { cols, pos: landed } = moveCard(view, grabbed.pos, to);
      setLocal(cols);
      setGrabbed({ id, pos: landed });
      setLive(announceMove(title, cols[landed.col]?.name ?? "", landed.index));
      focusAfter.current = id;
    }
  }

  // ── Adding a workstream ───────────────────────────────────────────────────

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    if (!profile || !taskName.trim()) return;
    setError(null);
    const { error: e } = await supabase
      .from("tasks")
      .insert({ engagement_id: engagementId, owner_id: profile.id, name: taskName.trim() });
    if (e) {
      setError(e.message);
      return;
    }
    setTaskName("");
    await queryClient.invalidateQueries({ queryKey: ["engagement-tasks", engagementId] });
  }

  const dragCard = drag ? cards.get(drag.id) : null;

  return (
    <section>
      <h2 className="micro-label">Workstreams</h2>

      <div className="nb-canvas mt-3">
        <div
          ref={scrollRef}
          className="nb-canvas-scroll"
          onScroll={(e) => {
            const node = e.currentTarget;
            const first = colRefs.current[0];
            const width = first?.getBoundingClientRect().width ?? 1;
            setPage(Math.round(node.scrollLeft / Math.max(width, 1)));
          }}
          onPointerMove={movePointer}
          onPointerUp={() => endPointer(false)}
          onPointerCancel={() => endPointer(true)}
        >
          {view.map((column, colIndex) => {
            const task = tasks.find((t) => t.id === column.id);
            if (!task) return null;
            return (
              <div
                key={column.id}
                ref={(node) => {
                  colRefs.current[colIndex] = node;
                }}
                className={`nb-col ${dropCol === colIndex && drag ? "nb-col-drop" : ""}`}
              >
                <WorkstreamColumnHeader
                  task={task}
                  count={column.cardIds.length}
                  confirmed={confirmedByTask.get(column.id) ?? false}
                  profile={profile}
                  canOrder={canEdit}
                  onReset={() => void onReset(column.id)}
                />

                <ul className="flex flex-col gap-2 p-3">
                  {column.cardIds.length === 0 ? (
                    <li className="text-xs text-muted-foreground">No work mapped yet</li>
                  ) : null}
                  {column.cardIds.map((cardId, index) => {
                    const element = cards.get(cardId);
                    if (!element) return null;
                    const item = element.work_items;
                    const pos: CanvasPos = { col: colIndex, index };
                    const lifted = drag?.id === cardId || grabbed?.id === cardId;
                    return (
                      <li key={cardId} className="flex items-stretch gap-2">
                        {canEdit ? (
                          <button
                            type="button"
                            aria-label={`Drag ${item.title}`}
                            tabIndex={-1}
                            className="nb-canvas-handle md:hidden"
                            onPointerDown={(e) => beginPointer(e, pos, cardId, true)}
                          >
                            <span aria-hidden>⋮⋮</span>
                          </button>
                        ) : null}
                        <div
                          ref={(node) => {
                            if (node) cardRefs.current.set(cardId, node);
                            else cardRefs.current.delete(cardId);
                          }}
                          role="button"
                          tabIndex={0}
                          aria-roledescription="Draggable card"
                          aria-grabbed={lifted}
                          data-lifted={lifted ? "true" : "false"}
                          onKeyDown={(e) => onCardKeyDown(e, pos, cardId)}
                          onPointerDown={(e) => beginPointer(e, pos, cardId, false)}
                          onClick={() => {
                            if (!startRef.current?.lifted) onOpen(item);
                          }}
                          className="nb-canvas-card flex min-w-0 flex-1 items-start gap-2 px-3 py-2 text-left"
                        >
                          <TypeIcon item={item} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-foreground">{item.title}</p>
                            <p className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                              {workIdentityLabel(item)} · {sourceLabel(item.source)} ·{" "}
                              {formatDate(effectiveWorkDate(item))}
                            </p>
                          </div>
                          {canEdit ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                aria-label={`Move ${item.title}`}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  disabled={busy || index === 0}
                                  onSelect={() =>
                                    applyMove(pos, { col: colIndex, index: index - 1 }, cardId)
                                  }
                                >
                                  Move up
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={busy || index === column.cardIds.length - 1}
                                  onSelect={() =>
                                    applyMove(pos, { col: colIndex, index: index + 1 }, cardId)
                                  }
                                >
                                  Move down
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                                  Move to workstream
                                </DropdownMenuLabel>
                                {view.map((other, otherIndex) =>
                                  otherIndex === colIndex ? null : (
                                    <DropdownMenuItem
                                      key={other.id}
                                      disabled={busy}
                                      onSelect={() =>
                                        applyMove(
                                          pos,
                                          { col: otherIndex, index: other.cardIds.length },
                                          cardId,
                                        )
                                      }
                                    >
                                      {other.name}
                                    </DropdownMenuItem>
                                  ),
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          {canEdit ? (
            <div className="nb-col nb-col-ghost">
              <form onSubmit={addTask} className="p-3">
                <p className="micro-label">Add a workstream</p>
                <Input
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="Add a workstream and press enter"
                  className="mt-2"
                />
              </form>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex justify-center gap-1.5 md:hidden" aria-hidden>
        {view.map((column, index) => (
          <span
            key={column.id}
            className={`nb-canvas-dot ${index === page ? "nb-canvas-dot-active" : ""}`}
          />
        ))}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {live}
      </p>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      {drag && dragCard ? (
        <div
          className="nb-canvas-ghost"
          style={{ left: drag.x, top: drag.y, width: drag.width }}
          aria-hidden
        >
          <p className="truncate text-sm text-foreground">{dragCard.work_items.title}</p>
        </div>
      ) : null}

      <Sheet open={moveSheet !== null} onOpenChange={(next) => (next ? null : setMoveSheet(null))}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto border-border bg-card pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Move to a workstream
          </SheetTitle>
          <div className="mt-3 flex flex-col gap-0.5">
            {view.map((column, index) =>
              moveSheet && index === moveSheet.from.col ? null : (
                <button
                  key={column.id}
                  type="button"
                  className="nb-nav-item min-h-[48px]"
                  onClick={() => {
                    if (!moveSheet) return;
                    applyMove(
                      moveSheet.from,
                      { col: index, index: column.cardIds.length },
                      moveSheet.id,
                    );
                    setMoveSheet(null);
                  }}
                >
                  {column.name}
                </button>
              ),
            )}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
