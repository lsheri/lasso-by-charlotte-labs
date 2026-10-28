import { Fragment, useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { GraphiteIcon } from "@/components/notebook/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { planToolbarOverflow, toolbarDividersBefore, type ToolbarControlSpec } from "@/lib/toolbar-overflow";

export type BoardToolbarItem = { spec: ToolbarControlSpec; row: ReactNode; menu?: ReactNode };

/** Each surface measures its own allocation, independently of the other surface's plan. */
export function BoardToolbarSurface({ surface, items, moreRef, extraMenu }: {
  surface: "header" | "floating";
  items: BoardToolbarItem[];
  moreRef?: Ref<HTMLButtonElement>;
  extraMenu?: ReactNode;
}) {
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = measureRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const read = () => {
      const style = getComputedStyle(element);
      setWidth(element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    };
    const observer = new ResizeObserver(read);
    observer.observe(element);
    read();
    return () => observer.disconnect();
  }, []);
  const toolbarPlan = planToolbarOverflow(width > 0 ? width : Number.MAX_SAFE_INTEGER, items.map((item) => item.spec));
  const row = items.filter((item) => toolbarPlan.row.includes(item.spec.id));
  const overflow = items.filter((item) => toolbarPlan.overflow.includes(item.spec.id));
  const dividers = new Set(toolbarDividersBefore(row.map((item) => item.spec)));
  const bandGroups = surface === "floating" ? [2, 3] : [4];
  const band = row.filter((item) => bandGroups.includes(item.spec.group ?? 0));
  const divider = <span aria-hidden="true" className="canvas-lab-toolbar-divider" />;
  const renderItem = (item: BoardToolbarItem, withDivider = true) => <Fragment key={item.spec.id}>{withDivider && dividers.has(item.spec.id) ? divider : null}<div className="flex shrink-0 items-center gap-2">{item.row}</div></Fragment>;
  const moreLabel = surface === "floating" ? "More drawing tools" : "More board controls";
  const content = <>
    {row.filter((item) => (item.spec.group ?? 0) < (bandGroups[0] ?? 0)).map((item) => renderItem(item))}
    {band.length > 0 ? <>{dividers.has(band[0]?.spec.id ?? "") ? divider : null}<div className="canvas-lab-tool-group">{band.map((item, index) => renderItem(item, index > 0))}</div></> : null}
    {row.filter((item) => (item.spec.group ?? 0) > (bandGroups.at(-1) ?? 0)).map((item) => renderItem(item))}
    {overflow.length > 0 || extraMenu ? <DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button ref={moreRef} size="icon" variant="ghost" aria-label={moreLabel} data-toolbar-control="more"><GraphiteIcon name="more" animate={false} /></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent>{moreLabel}</TooltipContent></Tooltip><DropdownMenuContent align="end">{overflow.map((item) => <Fragment key={item.spec.id}>{item.menu}</Fragment>)}{extraMenu}</DropdownMenuContent></DropdownMenu> : null}
  </>;
  return surface === "floating" ? (
    <div ref={measureRef} className="canvas-lab-floating-tools-wrapper" data-toolbar-surface="floating" data-toolbar-budget={width} data-toolbar-row={toolbarPlan.row.join(",")} data-toolbar-overflow={toolbarPlan.overflow.join(",")}>
      <div role="toolbar" aria-label="Drawing tools" className="canvas-lab-toolbar canvas-lab-floating-tools" onPointerDown={(event) => event.stopPropagation()}>{content}</div>
    </div>
  ) : (
    <div ref={measureRef} role="toolbar" aria-label="Board controls" data-toolbar-surface="header" data-toolbar-budget={width} data-toolbar-row={toolbarPlan.row.join(",")} data-toolbar-overflow={toolbarPlan.overflow.join(",")} className="canvas-lab-toolbar flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden">{content}</div>
  );
}