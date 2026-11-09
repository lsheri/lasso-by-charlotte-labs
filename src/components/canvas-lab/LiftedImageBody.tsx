import { useEffect, useState } from "react";

import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { signWorkboardFileUrl } from "@/lib/workboard-file-sign";

export const LIFT_IMAGE_COPY = {
  failed: "This picture could not be loaded.",
  videoFailed: "This video could not be loaded.",
} as const;

/**
 * LIFT-6: an image or a video in the lifted view, the same view every card lifts into. The picture is
 * fitted inside the view, never cropped and never enlarged past its own size. It signs its own short-lived
 * link, as the board does, and shows the local copy while that link is on its way.
 */
export function LiftedImageBody({ node }: { node: Pick<LabNode, "kind" | "imagePath" | "imagePreviewUrl"> }) {
  const isVideo = node.kind === "video";
  const [state, setState] = useState<{ url: string | null; failed: boolean; settled?: boolean }>({ url: null, failed: false });
  // The board revokes its local copy once the stored copy loads, so the local link can already be dead.
  const [previewDead, setPreviewDead] = useState(false);
  useEffect(() => {
    let live = true;
    if (!node.imagePath) {
      setState({ url: null, failed: !node.imagePreviewUrl });
      return;
    }
    signWorkboardFileUrl(node.imagePath, 3600)
      .then((url) => {
        if (live) setState({ url: url ?? null, failed: !url && !node.imagePreviewUrl, settled: true });
      })
      .catch(() => {
        if (live) setState({ url: null, failed: !node.imagePreviewUrl, settled: true });
      });
    return () => {
      live = false;
    };
  }, [node.imagePath, node.imagePreviewUrl]);
  const src = state.url ?? (previewDead ? null : node.imagePreviewUrl ?? null);
  // Only the stored copy failing is a failure; a dead local copy just waits for the signed link.
  const onMediaError = () => {
    if (state.url && src === state.url) setState({ url: null, failed: true });
    else setPreviewDead(true);
  };

  // The local copy is gone and signing gave nothing: that is a failure, not a wait.
  if (!src && previewDead && state.settled && !state.url) {
    return (
      <div className="lift-nothing" data-testid="lift-image-missing">
        <p>{isVideo ? LIFT_IMAGE_COPY.videoFailed : LIFT_IMAGE_COPY.failed}</p>
      </div>
    );
  }
  if (!state.failed && !src) return <div className="lift-image" data-testid="lift-image-waiting" />;
  if (state.failed || !src) {
    return (
      <div className="lift-nothing" data-testid="lift-image-missing">
        <p>{state.failed ? (isVideo ? LIFT_IMAGE_COPY.videoFailed : LIFT_IMAGE_COPY.failed) : null}</p>
      </div>
    );
  }
  return (
    <div className="lift-image" data-testid="lift-image">
      {isVideo ? (
        <video src={src} controls preload="metadata" playsInline onError={onMediaError} />
      ) : (
        <img src={src} alt="" draggable={false} onError={onMediaError} />
      )}
    </div>
  );
}
