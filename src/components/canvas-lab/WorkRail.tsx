import { ChevronRight, Paperclip, Plus, X } from "lucide-react";

import { ContextComposer } from "@/components/canvas-lab/ContextComposer";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { Button } from "@/components/ui/button";

export function WorkRail({ open, mobileVisible, context, hidden, canvasInstructions, onToggle, onRemoveContext, onSubmit, onCanvasInstructions, onRestore, onShowBoard }: { open: boolean; mobileVisible: boolean; context: LabNode[]; hidden: LabNode[]; canvasInstructions: string; onToggle: () => void; onRemoveContext: (id: string) => void; onSubmit: (prompt: string) => void; onCanvasInstructions: (value: string) => void; onRestore: (id: string) => void; onShowBoard: () => void }) {
  return (
    <aside className={`${open ? "canvas-lab-work-rail" : "canvas-lab-rail-collapsed"} ${mobileVisible ? "flex" : "hidden md:flex"}`} aria-label="Working from">
      {!open ? <Button type="button" variant="ghost" size="sm" className="h-auto min-h-32 w-10 px-1 [writing-mode:vertical-rl]" aria-label="Open working from rail" onClick={onToggle}><Paperclip className="mb-2 h-4 w-4" />Working from</Button> : null}
      <div hidden={!open} className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2"><Paperclip className="h-4 w-4 text-green" /><div><p className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">Working from</p><p className="font-hand text-[15px] text-green">selected work</p></div></div>
        <div className="flex gap-1"><Button type="button" size="icon" variant="ghost" className="md:hidden" aria-label="Show board" onClick={onShowBoard}><ChevronRight className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" aria-label="Collapse working from rail" onClick={onToggle}><X className="h-4 w-4" /></Button></div>
      </div>
      <div hidden={!open} className="min-h-0 flex-1 overflow-y-auto p-3"><ContextComposer context={context} onRemoveContext={onRemoveContext} onSubmit={onSubmit} canvasInstructions={canvasInstructions} onCanvasInstructions={onCanvasInstructions} /></div>
      <details hidden={!open} className="border-t border-border p-3"><summary className="cursor-pointer font-mono text-[9px] uppercase tracking-[0.08em] text-green">Add from engagement · {hidden.length}</summary>{hidden.length === 0 ? <p className="mt-2 text-[11.5px] text-muted-foreground">Nothing has been removed from this board.</p> : <ul className="mt-2 space-y-1">{hidden.map((node) => <li key={node.id}><Button type="button" size="sm" variant="ghost" className="h-auto w-full justify-start text-left text-[11.5px]" onClick={() => onRestore(node.id)}><Plus className="mr-1 h-3 w-3" />{node.title}</Button></li>)}</ul>}</details>
    </aside>
  );
}