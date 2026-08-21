import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";

import { AskSurface } from "@/components/reflect/AskSurface";
import {
  DOCK_MAX_WIDTH,
  DOCK_MIN_WIDTH,
  clampDockWidth,
  useAskDockState,
} from "@/components/reflect/ask-dock-state";
import { useAskLasso } from "@/components/reflect/use-ask-lasso";

/**
 * Ask Lasso, docked on the right of the page. Resizable between 320 and 560,
 * by pointer or by arrow key, and it keeps its width and tab across in-session
 * navigation.
 */
export function AskDock(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagementId: string;
  engagementTitle: string;
  profileId: string;
  orgId: string;
}) {
  const { open, onOpenChange, engagementId, engagementTitle, profileId, orgId } = props;
  const { width, setWidth, tab, setTab } = useAskDockState();
  const ask = useAskLasso({ open, engagementId, engagementTitle, profileId, orgId });
  const dragging = useRef(false);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragging.current) return;
      setWidth(window.innerWidth - event.clientX);
    },
    [setWidth],
  );

  useEffect(() => {
    const stop = () => {
      dragging.current = false;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stop);
    };
  }, [onPointerMove]);

  if (!open) return null;

  return (
    <aside
      aria-label="Ask Lasso"
      className="fixed inset-y-0 right-0 z-40 flex flex-col border-l border-border bg-background"
      style={{ width }}
    >
      <div
        role="separator"
        aria-label="Resize Ask Lasso"
        aria-orientation="vertical"
        aria-valuemin={DOCK_MIN_WIDTH}
        aria-valuemax={DOCK_MAX_WIDTH}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setWidth(clampDockWidth(width + 16));
          else if (event.key === "ArrowRight") setWidth(clampDockWidth(width - 16));
          else return;
          event.preventDefault();
        }}
        className="nb-dock-grip"
      />
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        aria-label="Close Ask Lasso"
        className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <AskSurface
        ask={ask}
        tab={tab}
        onTab={setTab}
        engagementId={engagementId}
        engagementTitle={engagementTitle}
        profileId={profileId}
        orgId={orgId}
        onClose={() => onOpenChange(false)}
      />
    </aside>
  );
}
