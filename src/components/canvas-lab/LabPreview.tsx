import { Maximize2 } from "lucide-react";

import { WorkboardFilePreview } from "@/components/canvas-lab/WorkboardFilePreview";
import { Button } from "@/components/ui/button";
import { SourceMark, VendorMark } from "@/components/work/SourceMark";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";
import type { WorkboardCardPreview, WorkboardFilePreview as FilePreview } from "@/lib/workboard-card-preview.shared";

export function LabPreview({ item, preview, filePreview, focused, onFailure, onPreviewScroll, onOpen }: { item: WorkItemRow; preview?: WorkboardCardPreview | undefined; filePreview?: FilePreview | undefined; focused: boolean; onFailure: () => void; onPreviewScroll?: ((kind: "chat" | "document" | "deck") => void) | undefined; onOpen: () => void }) {
  return <div data-drawing="preview" className="canvas-lab-preview-frame">
    <header className="canvas-lab-preview-source"><span><SourceMark item={item} size={12} /><VendorMark item={item} /> · {formatDate(effectiveWorkDate(item))}</span><Button type="button" size="icon" variant="ghost" aria-label={`Open ${item.title} larger`} title="Open larger" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onOpen(); }}><Maximize2 aria-hidden="true" /></Button></header>
    {item.type === "ai_thread" ? <div data-testid="workboard-chat-preview" data-focused={focused} className="canvas-lab-chat-preview canvas-lab-preview-content" onScroll={() => { if (focused) onPreviewScroll?.("chat"); }}>{(preview?.turns ?? []).map((turn) => <div key={turn.turnNo} className="canvas-lab-preview-turn"><span>{turn.role}</span><p>{turn.content}</p></div>)}</div> : filePreview ? <WorkboardFilePreview preview={filePreview} onFailure={onFailure} /> : null}
  </div>;
}