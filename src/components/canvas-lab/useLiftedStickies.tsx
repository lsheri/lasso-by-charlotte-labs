import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import {
  STICKY_UI_COPY,
  StickiesPanel,
  StickyLayer,
  StickyPad,
  stickyContent,
  stickyScroller,
  type StickyDraft,
} from "@/components/canvas-lab/LiftedStickies";
import {
  noteWorkboardStickyCreated,
  noteWorkboardStickyDone,
  noteWorkboardStickyOpened,
  noteWorkboardStickyRemoved,
  noteWorkboardStickyReopened,
} from "@/components/canvas-lab/canvas-lab-telemetry";
import { useBoardMentionPeople } from "@/hooks/use-board-mention-people";
import { useStickies } from "@/hooks/use-stickies";
import { liftKindOf } from "@/lib/lift-view";
import { anchorElement, showPage } from "@/lib/sticky-anchors";
import type { StickyDto } from "@/lib/stickies-shared";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * S2b: everything the one view needs for stickies on one piece of work, in one place so the board page
 * only wires it in: the pad for the rail, the layer drawn on the work, and the Stickies tab. A sticky being
 * written or read belongs to the piece it was opened on; moving to another piece starts clean.
 */
export function useLiftedStickies({
  engagementId,
  item,
  profileId,
  orgId,
  canWrite,
  body,
  focus,
}: {
  engagementId: string;
  item: WorkItemRow | null;
  profileId?: string | undefined;
  orgId?: string | undefined;
  canWrite: boolean;
  body: HTMLElement | null;
  /** S4b-2: a sticky to open on this piece (from a notification), once its list has loaded. */
  focus?: { stickyId: string; at: number } | null | undefined;
}): { pad: ReactNode; layer: ReactNode; panel: ReactNode; label: string } {
  const workItemId = item?.id ?? null;
  const { stickies, createSticky, editSticky, archiveSticky, setStickyDone } = useStickies(
    engagementId,
    workItemId,
    profileId,
  );
  // S4b: the people a sticky can ask, the same list mentions use. Undefined until it loads.
  const people = useBoardMentionPeople(engagementId, canWrite ? profileId : undefined);
  const [state, setState] = useState<{
    for: string | null;
    draft: StickyDraft | null;
    openId: string | null;
  }>({ for: null, draft: null, openId: null });
  // Moving to another piece starts clean, and coming back does not bring an old draft back.
  if (state.for !== workItemId) setState({ for: workItemId, draft: null, openId: null });
  const current = state.for === workItemId ? state : { for: workItemId, draft: null, openId: null };
  const workKind = item ? liftKindOf(item.type) : "other";

  // One sticky at a time: writing one closes any open sticky, and opening one drops an unsaved draft.
  const setDraft = useCallback(
    (draft: StickyDraft | null) =>
      setState({
        for: workItemId,
        draft: draft ? { ...draft, clientKey: draft.clientKey ?? crypto.randomUUID() } : null,
        openId: null,
      }),
    [workItemId],
  );
  const setOpen = useCallback(
    (openId: string | null) => setState({ for: workItemId, draft: null, openId }),
    [workItemId],
  );
  /** A save that returns after the view moved on clears only its own piece's draft, never another's. */
  const clearDraftFor = useCallback(
    (pieceId: string) => setState((s) => (s.for === pieceId ? { ...s, draft: null } : s)),
    [],
  );

  /** Turn to the sticky's spot and open it. */
  const reveal = useCallback(
    (sticky: StickyDto) => {
      const content = stickyContent(stickyScroller(body));
      const el = content ? anchorElement(content, sticky.anchor) : null;
      // On a paged file, a sticky on another page turns the file to its page first.
      if (!el && content && sticky.anchor.kind === "page") showPage(content, sticky.anchor.pageNo);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      setOpen(sticky.id);
    },
    [body, setOpen],
  );
  const go = useCallback(
    (sticky: StickyDto) => {
      reveal(sticky);
      noteWorkboardStickyOpened(orgId, "list");
    },
    [orgId, reveal],
  );

  // S4b-2: a notification's sticky opens on its spot once the work is drawn and its stickies have loaded.
  // The board records the open as from a notification; this only turns to it.
  const focused = useRef<number | null>(null);
  useEffect(() => {
    if (!focus || focused.current === focus.at || !body) return;
    const sticky = stickies.find((one) => one.id === focus.stickyId);
    if (!sticky) return;
    // Give the work a moment to draw its pages before turning to one. Handled only once it has opened, so
    // a list refresh in between does not lose it.
    const timer = window.setTimeout(() => {
      focused.current = focus.at;
      reveal(sticky);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [focus, stickies, body, reveal]);

  if (!item) return { pad: null, layer: null, panel: null, label: STICKY_UI_COPY.tab };
  const pieceId = item.id;
  const open = stickies.filter((sticky) => !sticky.doneAt);

  const layer = (
    <StickyLayer
      body={body}
      workKind={workKind}
      stickies={stickies}
      canWrite={canWrite}
      draft={current.draft}
      openId={current.openId}
      onOpen={(id) => {
        setOpen(id);
        if (id) noteWorkboardStickyOpened(orgId, "pin");
      }}
      onCancelDraft={() => setDraft(null)}
      people={people}
      onCreate={async (draft, text, fill, visibility, assigneeId) => {
        try {
          const result = await createSticky({
            // The piece the sticky was dropped on, never whatever is open by the time the save returns.
            workItemId: pieceId,
            anchor: draft.anchor,
            posX: draft.posX,
            posY: draft.posY,
            fill,
            body: text,
            visibility,
            clientKey: draft.clientKey ?? crypto.randomUUID(),
            assigneeProfileId: visibility === "just_me" ? null : assigneeId,
          });
          if (result.status !== "saved") return false;
          noteWorkboardStickyCreated(orgId, {
            anchor_kind: draft.anchor.kind,
            work_kind: workKind,
            assigned: visibility !== "just_me" && !!assigneeId,
            visibility: visibility === "just_me" ? "just_me" : "board",
          });
          clearDraftFor(pieceId);
          return true;
        } catch {
          return false;
        }
      }}
      onEdit={async (sticky, patch) => {
        try {
          const result = await editSticky({
            workItemId: pieceId,
            id: sticky.id,
            expectedVersion: sticky.version,
            ...patch,
          });
          return result.status === "saved";
        } catch {
          return false;
        }
      }}
      onSetDone={async (sticky, done) => {
        try {
          const result = await setStickyDone({
            workItemId: pieceId,
            id: sticky.id,
            done,
            expectedVersion: sticky.version,
          });
          if (result.status !== "saved") return false;
          if (done) noteWorkboardStickyDone(orgId, "view");
          else noteWorkboardStickyReopened(orgId);
          return true;
        } catch {
          return false;
        }
      }}
      onRemove={async (sticky) => {
        try {
          const result = await archiveSticky({
            workItemId: pieceId,
            id: sticky.id,
            expectedVersion: sticky.version,
          });
          if (result.status !== "saved") return false;
          noteWorkboardStickyRemoved(orgId, sticky.anchor.kind);
          return true;
        } catch {
          return false;
        }
      }}
    />
  );

  return {
    pad: canWrite ? (
      <StickyPad
        body={body}
        workKind={workKind}
        onDrop={(spot) => setDraft({ anchor: spot.anchor, posX: spot.posX, posY: spot.posY })}
      />
    ) : null,
    layer,
    panel: <StickiesPanel body={body} workKind={workKind} stickies={stickies} onGo={go} />,
    label: open.length ? `${STICKY_UI_COPY.tab} · ${open.length}` : STICKY_UI_COPY.tab,
  };
}
