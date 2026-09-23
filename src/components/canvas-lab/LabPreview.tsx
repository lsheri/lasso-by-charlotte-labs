import { Maximize2 } from "lucide-react";

import { WorkboardFilePreview } from "@/components/canvas-lab/WorkboardFilePreview";
import { Button } from "@/components/ui/button";
import { SourceMark, VendorMark } from "@/components/work/SourceMark";
import { sourceVendorKey } from "@/components/work/SourceMark";
import { ChatPreviewWindow } from "@/components/work/ChatPreviewWindow";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";
import type { WorkboardCardPreview, WorkboardFilePreview as FilePreview } from "@/lib/workboard-card-preview.shared";

export function LabPreview({ item, preview, filePreview, focused = false, onFailure, onPreviewScroll, onOpen }: { item: WorkItemRow; preview?: WorkboardCardPreview | undefined; filePreview?: FilePreview | undefined; focused?: boolean; onFailure: () => void; onPreviewScroll?: ((kind: "chat" | "document" | "deck" | "html" | "mermaid") => void) | undefined; onOpen: () => void }) {
  const shape = filePreview?.kind === "slide" ? "slide" : "portrait";
  return <div data-drawing="preview" data-preview-shape={shape} className="nb-paper canvas-lab-preview-frame">
    <header className="canvas-lab-preview-source"><span><SourceMark item={item} size={12} /><VendorMark item={item} /> · {formatDate(effectiveWorkDate(item))}</span><Button type="button" size="icon" variant="ghost" aria-label={`Open ${item.title} larger`} title="Open larger" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onOpen(); }}><Maximize2 aria-hidden="true" /></Button></header>
    <div className="nb-preview-content min-h-0 flex-1">
      {item.type === "ai_thread" ? <ChatPreviewWindow testId="workboard-chat-preview" vendorKey={sourceVendorKey(item)} turns={preview?.turns ?? []} /> : filePreview ? <div className="nb-document-preview-body h-full"><WorkboardFilePreview preview={filePreview} title={item.title} focused={focused} onFailure={onFailure} onPageChange={() => onPreviewScroll?.(filePreview.kind === "html" ? "html" : filePreview.kind === "mermaid" ? "mermaid" : item.type === "deck" ? "deck" : "document")} /></div> : null}
    </div>
  </div>;
}