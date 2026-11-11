import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

import { STICKY_FILL_NAMES, StickyMark } from "@/components/canvas-lab/StickyMark";
import type { AnnotationVisibility } from "@/lib/canvas-lab-annotations-shared";
import { WORKBOARD_STICKY_FILLS, type WorkboardStickyFill } from "@/lib/canvas-lab-shared";
import { anchorElement, onAnotherPage, placeIn, spotAt, type DropSpot } from "@/lib/sticky-anchors";
import {
  stickyPlace,
  validateStickyBody,
  type StickyAnchor,
  type StickyDto,
} from "@/lib/stickies-shared";

/*
 * S2b (stickies on the work, 10 Nov, Liam): while a piece of work is open in the one view, a sticky is
 * dragged from the rail onto a spot (a slide, a page, a chat turn, a doc section, a sheet row, or the piece
 * as a whole). It stays on that spot every time the work opens, for everyone on the board, unless its author
 * keeps it to themselves. S4b: a board sticky can ask one person on the board to act, and that person (or
 * the author) ticks it done. A done sticky stays on its spot, quieter.
 *
 * A sticky describes the work: its words and where it sits. Nothing here counts, times or ranks a person.
 */

export const STICKY_UI_COPY = {
  pad: "Sticky",
  padHint: "Drag a sticky onto any slide, page, row or turn",
  dropHere: "Drop it on the work",
  placeholder: "Write a note on this spot",
  board: "Board can see",
  justMe: "Just me",
  save: "Save",
  cancel: "Cancel",
  edit: "Edit",
  remove: "Remove",
  tab: "Stickies",
  heading: "On this piece",
  empty: "No stickies yet. Drag one from the rail onto any slide, page, row or turn.",
  moved: "This spot changed",
  movedHint: "The spot these were left on is no longer in the work. They stay here, never moved.",
  failed: "That sticky could not be saved. Try again.",
  you: "You",
  ask: "Ask",
  noOne: "No one",
  askJustMe: "Show it to the board to ask someone.",
  forWho: (name: string) => `For ${name}`,
  markDone: "Mark done",
  doneBy: (name: string) => `Done · ${name}`,
  done: "Done",
  /** S5: the work under the sticky has changed since it was left. Says so; never moves it. */
  changed: "This changed since the sticky was left. Check it still points to the right spot.",
  changedShort: "changed since",
} as const;

/** S4b: someone on the board a sticky can ask. */
export type StickyPerson = { profileId: string; displayName: string };

/** A sticky being written: where it was dropped, before it is saved. */
export type StickyDraft = {
  anchor: StickyAnchor;
  posX: number;
  posY: number;
  /** One key per sticky being written, so a retry after a slow save never makes a second sticky. */
  clientKey?: string | undefined;
};

/** The element that scrolls the work: a chat scrolls inside its frame, anything else is the body. */
export function stickyScroller(body: HTMLElement | null): HTMLElement | null {
  if (!body) return null;
  return body.querySelector<HTMLElement>(".chat-preview-window__body") ?? body;
}

/** The work's own content inside the scroller: spots live in it, and "the whole piece" is it. */
export function stickyContent(scroller: HTMLElement | null): HTMLElement | null {
  if (!scroller) return null;
  // The layer lives in the same scroller. When the work swaps its root (a preview arrives, a file fails),
  // the new root lands after the layer, so the work is the first child that is not the layer.
  for (const child of Array.from(scroller.children)) {
    if (!child.classList.contains("sticky-layer")) return child as HTMLElement;
  }
  return scroller;
}

/** Where a drop at a point lands, or null when it is not on the work. */
export function dropSpot(
  body: HTMLElement | null,
  clientX: number,
  clientY: number,
  target: Element | null,
): DropSpot | null {
  const content = stickyContent(stickyScroller(body));
  if (!content) return null;
  return spotAt(target, content, clientX, clientY);
}

/* ---------------- the pad in the rail ---------------- */

/** The work under a point, looking through stickies already on it. */
function workAt(x: number, y: number): Element | null {
  const all =
    typeof document.elementsFromPoint === "function"
      ? document.elementsFromPoint(x, y)
      : [document.elementFromPoint(x, y)];
  return all.find((el) => el && !el.closest(".sticky-layer, .sticky-ghost")) ?? null;
}

export function StickyPad({
  body,
  workKind,
  onDrop,
}: {
  body: HTMLElement | null;
  /** So the drag says "Slide 3" on a deck and "Page 3" anywhere else. */
  workKind?: string | undefined;
  onDrop: (spot: DropSpot) => void;
}) {
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);
  const moved = useRef(false);
  const lit = useRef<HTMLElement | null>(null);
  const stopDrag = useRef<(() => void) | null>(null);

  // A view that closes mid-drag leaves nothing listening.
  useEffect(() => () => stopDrag.current?.(), []);

  /** Without a drag (a keyboard press, or a press and release): a sticky in the middle of what is on screen. */
  function dropInMiddle() {
    const scroller = stickyScroller(body);
    if (!scroller) return;
    const box = scroller.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + Math.min(box.height / 2, 160);
    const spot = dropSpot(body, x, y, workAt(x, y));
    if (spot) onDrop(spot);
  }

  function light(el: HTMLElement | null) {
    if (lit.current && lit.current !== el) lit.current.classList.remove("sticky-drop-target");
    if (el) el.classList.add("sticky-drop-target");
    lit.current = el;
  }

  function begin(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    moved.current = false;
    const startX = event.clientX;
    const startY = event.clientY;
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 4) moved.current = true;
      const spot = dropSpot(body, ev.clientX, ev.clientY, workAt(ev.clientX, ev.clientY));
      light(spot?.el ?? null);
      setGhost({
        x: ev.clientX,
        y: ev.clientY,
        label: spot ? stickyPlace(spot.anchor, workKind) : STICKY_UI_COPY.dropHere,
      });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", stop, true);
      stopDrag.current = null;
      light(null);
      setGhost(null);
    };
    const up = (ev: PointerEvent) => {
      stop();
      if (!moved.current) {
        dropInMiddle();
        return;
      }
      const spot = dropSpot(body, ev.clientX, ev.clientY, workAt(ev.clientX, ev.clientY));
      if (spot) onDrop(spot);
    };
    stopDrag.current?.();
    stopDrag.current = stop;
    // Capture phase: the one view stops presses at its root so the board never sees them, which would
    // also stop a bubbling listener here from ever hearing the release.
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", stop, true);
  }

  return (
    <>
      <button
        type="button"
        className="sticky-pad"
        data-testid="sticky-pad"
        aria-label={STICKY_UI_COPY.padHint}
        title={STICKY_UI_COPY.padHint}
        onPointerDown={begin}
        onClick={(event) => {
          // Enter or Space: the keyboard's way to leave a sticky.
          if (event.detail === 0) dropInMiddle();
        }}
      >
        <StickyMark variant="stack" size={26} />
        <span>{STICKY_UI_COPY.pad}</span>
      </button>
      {ghost
        ? createPortal(
            <div
              className="sticky-ghost"
              aria-hidden="true"
              style={{ left: ghost.x, top: ghost.y }}
            >
              {ghost.label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/* ---------------- the stickies drawn on the work ---------------- */

type Positions = Record<string, { left: number; top: number } | null>;

function useStickyPositions(
  scroller: HTMLElement | null,
  stickies: readonly StickyDto[],
  draft: StickyDraft | null,
): Positions {
  const [positions, setPositions] = useState<Positions>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!scroller) return;
    const content = stickyContent(scroller);
    let frame = 0;
    const bump = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTick((n) => n + 1));
    };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(bump);
    resize?.observe(scroller);
    if (content) resize?.observe(content);
    // Watch the whole scroller, so a swapped root is seen too; changes inside the layer are its own.
    const layerOnly = (records: MutationRecord[]) =>
      records.every(
        (record) =>
          record.target instanceof Element && Boolean(record.target.closest(".sticky-layer")),
      );
    const mutate =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver((records) => {
            if (layerOnly(records)) return;
            const next = stickyContent(scroller);
            if (next && next !== content) resize?.observe(next);
            bump();
          });
    // A paged file turning its page changes which page is a spot; watch that attribute too.
    mutate?.observe(scroller, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-anchor-page"],
    });
    window.addEventListener("resize", bump);
    // Slides, pages and turns arrive after the view opens; measure again as they settle.
    const settle = [120, 400, 900, 1600].map((ms) => setTimeout(bump, ms));
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      mutate?.disconnect();
      window.removeEventListener("resize", bump);
      settle.forEach(clearTimeout);
    };
  }, [scroller]);

  useLayoutEffect(() => {
    const content = stickyContent(scroller);
    if (!scroller || !content) return;
    const next: Positions = {};
    for (const sticky of stickies) {
      const el = anchorElement(content, sticky.anchor);
      next[sticky.id] = el ? placeIn(scroller, el, sticky.posX, sticky.posY) : null;
    }
    if (draft) {
      const el = anchorElement(content, draft.anchor);
      next["draft"] = el ? placeIn(scroller, el, draft.posX, draft.posY) : null;
    }
    setPositions(next);
  }, [scroller, stickies, draft, tick]);

  return positions;
}

export type StickyLayerProps = {
  body: HTMLElement | null;
  workKind: string;
  stickies: readonly StickyDto[];
  canWrite: boolean;
  draft: StickyDraft | null;
  openId: string | null;
  onOpen: (id: string | null) => void;
  onCancelDraft: () => void;
  onCreate: (
    draft: StickyDraft,
    body: string,
    fill: WorkboardStickyFill,
    visibility: AnnotationVisibility,
    assigneeId: string | null,
  ) => Promise<boolean>;
  onEdit: (
    sticky: StickyDto,
    patch: {
      body: string;
      fill: WorkboardStickyFill;
      visibility: AnnotationVisibility;
      assigneeProfileId?: string | null;
    },
  ) => Promise<boolean>;
  onRemove: (sticky: StickyDto) => Promise<boolean>;
  /** S4b: the people on the board a sticky can ask. Undefined while they load. */
  people?: readonly StickyPerson[] | undefined;
  /** S4b: tick done, or reopen. */
  onSetDone?: ((sticky: StickyDto, done: boolean) => Promise<boolean>) | undefined;
};

export function StickyLayer(props: StickyLayerProps) {
  const { body, workKind, stickies, draft, openId, onOpen } = props;
  const scroller = stickyScroller(body);
  const positions = useStickyPositions(scroller, stickies, draft);

  useEffect(() => {
    if (!scroller) return;
    scroller.classList.add("has-stickies");
    return () => scroller.classList.remove("has-stickies");
  }, [scroller]);

  if (!scroller) return null;
  const openSticky = stickies.find((sticky) => sticky.id === openId) ?? null;
  const at = (id: string) => positions[id] ?? null;

  return createPortal(
    <div className="sticky-layer" data-testid="sticky-layer">
      {stickies.map((sticky) => {
        const spot = at(sticky.id);
        if (!spot) return null;
        return (
          <button
            key={sticky.id}
            type="button"
            className="sticky-pin"
            data-testid="sticky-pin"
            data-open={openId === sticky.id ? "true" : undefined}
            data-just-me={sticky.visibility === "just_me" ? "true" : undefined}
            data-done={sticky.doneAt ? "true" : undefined}
            data-for-me={sticky.isAssignedToMe && !sticky.doneAt ? "true" : undefined}
            data-stale={sticky.stale ? "true" : undefined}
            aria-label={`${sticky.doneAt ? `${STICKY_UI_COPY.done} sticky` : "Sticky"} on ${stickyPlace(sticky.anchor, workKind)}: ${sticky.body}`}
            style={{ left: spot.left, top: spot.top }}
            onClick={() => onOpen(openId === sticky.id ? null : sticky.id)}
          >
            <StickyMark variant="sheet" fill={sticky.fill} size={30} lines={false} />
          </button>
        );
      })}
      {draft && at("draft") ? (
        <>
          <span className="sticky-pin" data-open="true" aria-hidden="true" style={at("draft")!}>
            <StickyMark variant="sheet" size={30} lines={false} />
          </span>
          <StickyCard
            key="draft"
            mode="new"
            place={stickyPlace(draft.anchor, workKind)}
            spot={at("draft")!}
            scroller={scroller}
            {...props}
          />
        </>
      ) : null}
      {openSticky && at(openSticky.id) ? (
        <StickyCard
          key={openSticky.id}
          mode="view"
          sticky={openSticky}
          place={stickyPlace(openSticky.anchor, workKind)}
          spot={at(openSticky.id)!}
          scroller={scroller}
          {...props}
        />
      ) : null}
    </div>,
    scroller,
  );
}

/** The sticky itself, opened: read it, or write it. */
function StickyCard({
  mode: initialMode,
  sticky,
  place,
  spot,
  scroller,
  canWrite,
  draft,
  onOpen,
  onCancelDraft,
  onCreate,
  onEdit,
  onRemove,
  people,
  onSetDone,
}: StickyLayerProps & {
  mode: "new" | "view";
  sticky?: StickyDto | undefined;
  place: string;
  spot: { left: number; top: number };
  scroller: HTMLElement;
}) {
  const [mode, setMode] = useState<"new" | "view" | "edit">(initialMode);
  const [text, setText] = useState(sticky?.body ?? "");
  const [fill, setFill] = useState<WorkboardStickyFill>(sticky?.fill ?? "yellow");
  const [visibility, setVisibility] = useState<AnnotationVisibility>(
    sticky?.visibility ?? "engagement",
  );
  const [assignee, setAssignee] = useState<string | null>(sticky?.assigneeId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const visName = `sticky-vis-${id}`;
  // Whoever it already asks stays in the list even if they are not among the people loaded (yourself, say).
  const askable: StickyPerson[] = [...(people ?? [])];
  if (sticky?.assigneeId && !askable.some((person) => person.profileId === sticky.assigneeId))
    askable.push({ profileId: sticky.assigneeId, displayName: sticky.assigneeName ?? STICKY_UI_COPY.you });
  const writing = mode !== "view";

  // Esc (from the view) cancels what is being written, or closes the sticky.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cancel = () =>
      mode === "new" ? onCancelDraft() : mode === "edit" ? setMode("view") : onOpen(null);
    el.addEventListener("lift-esc", cancel);
    return () => el.removeEventListener("lift-esc", cancel);
  });

  // A press anywhere else on the work closes a sticky that is only being read.
  useEffect(() => {
    if (writing) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target && (ref.current?.contains(target) || target.closest(".sticky-pin"))) return;
      onOpen(null);
    };
    window.addEventListener("pointerdown", away, true);
    return () => window.removeEventListener("pointerdown", away, true);
  }, [writing, onOpen]);

  // Open to the right of the sticky, or to its left near the edge.
  const flip = spot.left + 300 > scroller.scrollLeft + scroller.clientWidth;
  const style = {
    left: flip ? Math.max(8, spot.left - 292) : spot.left + 24,
    top: Math.max(8, spot.top - 18),
  };

  async function save() {
    const bad = validateStickyBody(text);
    if (bad) {
      setError(bad);
      return;
    }
    setBusy(true);
    setError(null);
    // A just-me sticky never asks anyone.
    const askId = visibility === "just_me" ? null : assignee;
    const ok =
      mode === "new" && draft
        ? await onCreate(draft, text, fill, visibility, askId)
        : sticky
          ? await onEdit(sticky, {
              body: text,
              fill,
              visibility,
              ...(askId !== sticky.assigneeId ? { assigneeProfileId: askId } : {}),
            })
          : false;
    setBusy(false);
    if (!ok) setError(STICKY_UI_COPY.failed);
    else if (mode === "edit") setMode("view");
  }

  return (
    <div
      ref={ref}
      className="sticky-card"
      data-fill={fill}
      data-testid="sticky-card"
      data-lift-esc=""
      role="dialog"
      aria-label={`Sticky on ${place}`}
      style={style}
    >
      <p className="sticky-card-place">
        {place}
        {(sticky?.visibility ?? visibility) === "just_me" && !writing
          ? ` · ${STICKY_UI_COPY.justMe}`
          : ""}
      </p>
      {writing ? (
        <>
          <textarea
            className="sticky-card-text"
            aria-label={STICKY_UI_COPY.placeholder}
            placeholder={STICKY_UI_COPY.placeholder}
            value={text}
            autoFocus
            maxLength={4000}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void save();
            }}
          />
          <div className="sticky-card-fills" role="group" aria-label="Sticky colour">
            {WORKBOARD_STICKY_FILLS.map((one) => (
              <button
                key={one}
                type="button"
                className="canvas-lab-sticky-swatch"
                data-fill={one}
                aria-label={STICKY_FILL_NAMES[one]}
                title={STICKY_FILL_NAMES[one]}
                aria-pressed={fill === one}
                onClick={() => setFill(one)}
              />
            ))}
          </div>
          <div className="sticky-card-vis" role="radiogroup" aria-label="Who can see it">
            <label>
              <input
                type="radio"
                name={visName}
                checked={visibility === "engagement"}
                onChange={() => setVisibility("engagement")}
              />{" "}
              {STICKY_UI_COPY.board}
            </label>
            <label>
              <input
                type="radio"
                name={visName}
                checked={visibility === "just_me"}
                onChange={() => setVisibility("just_me")}
              />{" "}
              {STICKY_UI_COPY.justMe}
            </label>
          </div>
          <label className="sticky-card-ask">
            <span>{STICKY_UI_COPY.ask}</span>
            <select
              aria-label={STICKY_UI_COPY.ask}
              value={visibility === "just_me" ? "" : (assignee ?? "")}
              disabled={visibility === "just_me" || people === undefined}
              title={visibility === "just_me" ? STICKY_UI_COPY.askJustMe : undefined}
              onChange={(event) => setAssignee(event.target.value || null)}
            >
              <option value="">{STICKY_UI_COPY.noOne}</option>
              {askable.map((person) => (
                <option key={person.profileId} value={person.profileId}>
                  {person.displayName}
                </option>
              ))}
            </select>
          </label>
          {error ? (
            <p className="sticky-card-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="sticky-card-acts">
            <button
              type="button"
              onClick={() => (mode === "new" ? onCancelDraft() : setMode("view"))}
            >
              {STICKY_UI_COPY.cancel}
            </button>
            <span />
            <button
              type="button"
              className="sticky-card-go"
              disabled={busy}
              onClick={() => void save()}
            >
              {STICKY_UI_COPY.save}
            </button>
          </div>
        </>
      ) : sticky ? (
        <>
          <p className="sticky-card-body" data-done={sticky.doneAt ? "true" : undefined}>
            {sticky.body}
          </p>
          <p className="sticky-card-meta">
            {sticky.isMine ? STICKY_UI_COPY.you : sticky.authorName}
            {sticky.assigneeName ? ` · ${STICKY_UI_COPY.forWho(sticky.assigneeName)}` : ""}
          </p>
          {sticky.stale ? (
            <p className="sticky-card-changed" data-testid="sticky-card-changed">{STICKY_UI_COPY.changed}</p>
          ) : null}
          {sticky.doneAt ? (
            <p className="sticky-card-done">{STICKY_UI_COPY.doneBy(sticky.doneByName ?? STICKY_UI_COPY.you)}</p>
          ) : null}
          {sticky.canMarkDone && onSetDone ? (
            <label className="sticky-card-tick">
              <input
                type="checkbox"
                checked={!!sticky.doneAt}
                disabled={busy}
                onChange={async (event) => {
                  setBusy(true);
                  setError(null);
                  const ok = await onSetDone(sticky, event.target.checked);
                  setBusy(false);
                  if (!ok) setError(STICKY_UI_COPY.failed);
                }}
              />{" "}
              {sticky.doneAt ? STICKY_UI_COPY.done : STICKY_UI_COPY.markDone}
            </label>
          ) : null}
          {sticky.isMine && canWrite ? (
            <div className="sticky-card-acts">
              <button type="button" onClick={() => setMode("edit")}>
                {STICKY_UI_COPY.edit}
              </button>
              <span />
              <button
                type="button"
                onClick={async () => {
                  setBusy(true);
                  const ok = await onRemove(sticky);
                  setBusy(false);
                  if (ok) onOpen(null);
                  else setError(STICKY_UI_COPY.failed);
                }}
                disabled={busy}
              >
                {STICKY_UI_COPY.remove}
              </button>
            </div>
          ) : null}
          {error ? (
            <p className="sticky-card-error" role="alert">
              {error}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ---------------- the Stickies tab ---------------- */

function placeOrder(anchor: StickyAnchor): number {
  switch (anchor.kind) {
    case "page":
      return anchor.pageNo;
    case "turn":
      return anchor.turnNo;
    case "row":
      return Number(anchor.rowKey) || 0;
    default:
      return 0;
  }
}

export function StickiesPanel({
  body,
  workKind,
  stickies,
  onGo,
}: {
  body: HTMLElement | null;
  workKind: string;
  stickies: readonly StickyDto[];
  onGo: (sticky: StickyDto) => void;
}) {
  const content = stickyContent(stickyScroller(body));
  // S4b: done stickies are listed last, apart, so the list reads as what is still open.
  const done = stickies.filter((sticky) => sticky.doneAt);
  const sorted = stickies.filter((sticky) => !sticky.doneAt).sort(
    (a, b) => placeOrder(a.anchor) - placeOrder(b.anchor) || a.createdAt.localeCompare(b.createdAt),
  );
  // A sticky on a page not shown (a paged file) is listed and opens its page. A sticky whose spot left the
  // work is listed apart, never drawn somewhere else.
  const placed = content
    ? sorted.filter(
        (sticky) => anchorElement(content, sticky.anchor) || onAnotherPage(content, sticky.anchor),
      )
    : sorted;
  const moved = content
    ? sorted.filter(
        (sticky) =>
          !anchorElement(content, sticky.anchor) && !onAnotherPage(content, sticky.anchor),
      )
    : [];
  const row = (sticky: StickyDto, go: boolean) => (
    <li key={sticky.id}>
      <button type="button" className="sticky-list-row" disabled={!go} onClick={() => onGo(sticky)}>
        <StickyMark variant="sheet" fill={sticky.fill} size={16} lines={false} />
        <span>
          <span className="sticky-list-text">{sticky.body}</span>
          <small>
            {stickyPlace(sticky.anchor, workKind)} ·{" "}
            {sticky.isMine ? STICKY_UI_COPY.you : sticky.authorName}
            {sticky.assigneeName ? ` · ${STICKY_UI_COPY.forWho(sticky.assigneeName)}` : ""}
            {sticky.visibility === "just_me" ? ` · ${STICKY_UI_COPY.justMe}` : ""}
            {sticky.stale ? ` · ${STICKY_UI_COPY.changedShort}` : ""}
          </small>
        </span>
      </button>
    </li>
  );
  return (
    <div className="stickies-panel" data-testid="stickies-panel">
      <h4>{STICKY_UI_COPY.heading}</h4>
      {placed.length ? (
        <ul className="sticky-list">{placed.map((sticky) => row(sticky, true))}</ul>
      ) : !moved.length && !done.length ? (
        <p className="stickies-empty">{STICKY_UI_COPY.empty}</p>
      ) : null}
      {moved.length ? (
        <>
          <h4>{STICKY_UI_COPY.moved}</h4>
          <p className="stickies-empty">{STICKY_UI_COPY.movedHint}</p>
          <ul className="sticky-list">{moved.map((sticky) => row(sticky, false))}</ul>
        </>
      ) : null}
      {done.length ? (
        <>
          <h4>{STICKY_UI_COPY.done}</h4>
          <ul className="sticky-list" data-done="true">
            {done.map((sticky) =>
              row(sticky, !content || !!anchorElement(content, sticky.anchor) || onAnotherPage(content, sticky.anchor)),
            )}
          </ul>
        </>
      ) : null}
    </div>
  );
}
