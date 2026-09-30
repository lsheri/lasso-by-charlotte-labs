import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { moveWorkboard, reparentClient } from "@/hooks/use-clients";
import type { ContainerRow } from "@/lib/nav-groups";
import {
  canDropOn,
  DRAG_MIME,
  performDrop,
  type DragItem,
  type DropTarget,
  type PendingMoves,
} from "@/lib/sidebar-drag";
import { logEvent } from "@/lib/telemetry";

/** How long a drag rests on a collapsed container before it opens. */
export const HOVER_EXPAND_MS = 600;

type DragApi = {
  item: DragItem | null;
  overKey: string | null;
  /** Props for a draggable row. Undefined when drag is off (guests). */
  dragSource: (item: DragItem) => {
    draggable: true;
    onDragStart: (event: DragEvent) => void;
    onDragEnd: () => void;
  };
  /** Props for a drop target. `onHoverOpen` runs after a rest on it. */
  dropTarget: (
    target: DropTarget,
    onHoverOpen?: () => void,
  ) => {
    "data-drop-state"?: "over" | "refused";
    onDragOver: (event: DragEvent) => void;
    onDragEnter: (event: DragEvent) => void;
    onDragLeave: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
  };
  /** Swallows the click a browser can fire at the end of a drag. */
  onClickCapture: (event: { preventDefault: () => void; stopPropagation: () => void }) => void;
};

const Ctx = createContext<DragApi | null>(null);

export function useSidebarDrag(): DragApi | null {
  return useContext(Ctx);
}

const keyOf = (target: DropTarget) => (target.type === "top" ? "top" : `container:${target.id}`);

/**
 * Unit 4e: native HTML5 drag, no dependency. Owns the drag state and the
 * optimistic overlay; SidebarNav applies `pending` to the rows it draws.
 */
export function SidebarDragProvider({
  rows,
  orgId,
  pending,
  setPending,
  children,
}: {
  rows: readonly ContainerRow[];
  orgId: string | undefined;
  pending: PendingMoves;
  setPending: (update: (prev: PendingMoves) => PendingMoves) => void;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [item, setItem] = useState<DragItem | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickUntil = useRef(0);
  void pending;

  const clearHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };

  const end = useCallback(() => {
    clearHover();
    setItem(null);
    setOverKey(null);
    suppressClickUntil.current = Date.now() + 300;
  }, []);

  // Escape cancels: the browser drops nothing, and our state clears too.
  useEffect(() => {
    if (!item) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") end();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, end]);

  const api = useMemo<DragApi>(
    () => ({
      item,
      overKey,
      dragSource: (source) => ({
        draggable: true,
        onDragStart: (event) => {
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "move";
          // Our own type only, so dropping on the page never opens a link.
          event.dataTransfer.setData(DRAG_MIME, source.id);
          setItem(source);
        },
        onDragEnd: end,
      }),
      dropTarget: (target, onHoverOpen) => {
        const key = keyOf(target);
        const allowed = item ? canDropOn(rows, item, target) : false;
        const state = item && overKey === key ? (allowed ? "over" : "refused") : undefined;
        return {
          ...(state ? { "data-drop-state": state } : {}),
          onDragEnter: (event) => {
            if (!item) return;
            event.preventDefault();
            event.stopPropagation();
            if (overKey !== key) {
              setOverKey(key);
              clearHover();
              if (onHoverOpen) hoverTimer.current = setTimeout(onHoverOpen, HOVER_EXPAND_MS);
            }
          },
          onDragOver: (event) => {
            if (!item) return;
            event.stopPropagation();
            // Always prevent the default so the browser never navigates;
            // the drop effect tells the person whether this target takes it.
            event.preventDefault();
            event.dataTransfer.dropEffect = allowed ? "move" : "none";
            if (overKey !== key) setOverKey(key);
          },
          onDragLeave: (event) => {
            event.stopPropagation();
            const related = event.relatedTarget as Node | null;
            if (related && (event.currentTarget as Node).contains(related)) return;
            if (overKey === key) {
              clearHover();
              setOverKey(null);
            }
          },
          onDrop: (event) => {
            event.preventDefault();
            event.stopPropagation();
            const dragged = item;
            end();
            if (!dragged || !allowed) return;
            void performDrop({
              item: dragged,
              target,
              rows,
              calls: {
                reparent: reparentClient,
                moveWorkboard,
                log: (name, dims) => {
                  if (orgId) logEvent(name, orgId, dims);
                },
              },
              setPending,
              onRefused: (message) => toast.error(message),
              onSettled: async () => {
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ["clients"] }),
                  queryClient.invalidateQueries({ queryKey: ["engagements"] }),
                ]);
              },
            });
          },
        };
      },
      onClickCapture: (event) => {
        if (Date.now() < suppressClickUntil.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
    }),
    [item, overKey, rows, orgId, setPending, queryClient, end],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
