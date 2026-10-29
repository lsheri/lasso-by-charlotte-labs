import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BoardToolbarSurface, type BoardToolbarItem } from "@/components/canvas-lab/BoardToolbarSurface";
import { Button } from "@/components/ui/button";
import { GraphiteIcon } from "@/components/notebook/icons";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
const G = [["add-work"],["add-text","add-sticky","region","section","suggest"],["card-face","fit","zoom"],["working-from","ask","share","details"]];
const toolbarGroupOf = (id: string) => G.findIndex((g) => g.includes(id)) + 1;
export const Route = createFileRoute("/qa-t8")({ component: Q });
function Q() {
  const [w, setW] = useState(1280);
  useEffect(() => setW(window.innerWidth), []);
  const p = w < 768;
  const icon = (id: string, label: string, width = 36, moveOrder?: number): BoardToolbarItem => ({ spec: { id, width, moveOrder }, row: <Button size="icon" variant="outline" aria-label={label} data-toolbar-control={id}><GraphiteIcon name="text" size={20} /></Button>, menu: <DropdownMenuItem>{label}</DropdownMenuItem> });
  const items: BoardToolbarItem[] = [
    { spec: { id: "add-work", width: p ? 36 : 106, pinned: true }, row: <Button size="sm" variant="outline" className="lasso-action" aria-label="Add work" data-toolbar-control="add-work"><GraphiteIcon name="work" size={20} /><span className="canvas-lab-add-work-label">Add work</span></Button> },
    icon("add-text", "Add text", 36, 5), icon("add-sticky", "Sticky", 36, 6), icon("region", "Draw a workstream", 36, 9), icon("section", "Draw a section", 36, 10), icon("suggest", "Suggest workstreams", 36, 7),
    icon("card-face", "Show work as", p ? 68 : 165), icon("fit", "Fit", 36, 2),
    { spec: p ? { id: "zoom", width: 124, moveOrder: 0 } : { id: "zoom", width: 124, pinned: true }, row: <><Button size="icon" variant="ghost" aria-label="Zoom out"><GraphiteIcon name="minus" size={18} /></Button><button type="button" className="w-10 text-center font-mono text-[10px]">100%</button><Button size="icon" variant="ghost" aria-label="Zoom in"><GraphiteIcon name="plus" size={18} /></Button></>, menu: <><DropdownMenuItem>Zoom in</DropdownMenuItem><DropdownMenuItem>Zoom out</DropdownMenuItem></> },
    { spec: { id: "working-from", width: p ? 36 : 0, pinned: true }, row: <Button size="icon" variant="outline" className="md:hidden" aria-label="Working from" data-toolbar-control="working-from"><GraphiteIcon name="ask-lasso" size={20} /></Button> },
    { spec: { id: "ask", width: p ? 36 : 124, pinned: true }, row: <Button size="sm" variant="outline" aria-label="Ask Lasso" data-toolbar-control="ask" className="canvas-lab-ask-button"><span className="canvas-lab-ask-mark">o</span><span className="canvas-lab-ask-label">Ask Lasso</span></Button> },
    { spec: { id: "share", width: 36, pinned: true }, row: <Button size="icon" variant="outline" aria-label="Share"><GraphiteIcon name="text" size={20} /></Button> },
    icon("details", "Info", 36, 3),
  ];
  for (const i of items) i.spec = { ...i.spec, group: toolbarGroupOf(i.spec.id) };
  return <TooltipProvider><div data-lasso="on" className="fixed inset-0"><div className="canvas-lab-surface relative h-full" style={{ marginLeft: 52 }}>{w ? <BoardToolbarSurface key={w} items={items} /> : null}</div></div></TooltipProvider>;
}
