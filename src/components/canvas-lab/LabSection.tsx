import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LabFrame, LabResizeCorner } from "@/components/canvas-lab/canvas-lab-model";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SECTION_TITLE_PLACEHOLDER, dayOf, isWeekPeriod, markerLabel, monthOf, sectionTitle, setNumberMarker, setPeriodMarker, shift, weekOf, type SectionMarker } from "@/lib/board-section";

type MarkedRect = { x: number; y: number; width: number; height: number; periodStart?: string | null; periodEnd?: string | null };
export const NEXT_WEEK_SECTION_GAP = 40;

/** Shifting moves the week's dates only; null when the section is not a week. */
export function shiftedSectionMarker(frame: MarkedRect, direction: "next" | "previous"): SectionMarker | null {
  const period = { periodStart: frame.periodStart ?? null, periodEnd: frame.periodEnd ?? null };
  if (!period.periodStart || !period.periodEnd || !isWeekPeriod(period)) return null;
  return setPeriodMarker(shift({ periodStart: period.periodStart, periodEnd: period.periodEnd }, direction));
}

/** An empty sibling to the right, same size, set to the week after this section's week (or after today's). */
export function nextWeekSectionRect(frame: MarkedRect, today: Date): { x: number; y: number; width: number; height: number; marker: SectionMarker } {
  const base = shiftedSectionMarker(frame, "next") ?? setPeriodMarker(shift(weekOf(today), "next"));
  return { x: frame.x + frame.width + NEXT_WEEK_SECTION_GAP, y: frame.y, width: frame.width, height: frame.height, marker: base };
}

export type SectionMarkerChoice = { kind: "period" | "number"; preset: "day" | "week" | "month" | "custom" | "none"; via: "menu" | "line" };
type PickerState = { mode: "period" | "custom" | "number"; via: "menu" | "line" } | null;

/** SECD-1b: every word a person reads on the section marker controls. */
export const SECTION_MARKER_COPY = {
  ask: "Ask Lasso about this section",
  setPeriod: "Set period",
  setNumber: "Set number",
  clear: "Clear marker",
  shiftNext: "Shift to next week",
  shiftPrevious: "Shift to previous week",
  newNextWeek: "New section for next week",
  day: "Day",
  week: "Week",
  month: "Month",
  custom: "Custom range",
  from: "From",
  to: "To",
  number: "Number",
  set: "Set",
  cancel: "Cancel",
  pickerLabel: "Section marker",
} as const;

const CORNERS: LabResizeCorner[] = ["nw", "ne", "se", "sw"];

export function LabSection({ frame, title, selected, editable, autoName = false, onSelect, onDragStart, onResizeStart, onResizeKeyDown, onResizeKeyUp, onRename, onRemove, onMenuOpened, onMarker, onClearMarker, onShift, onNewNextWeek, onAsk }: {
  frame: LabFrame; title: string | null; selected: boolean; editable: boolean;
  autoName?: boolean;
  onSelect: () => void;
  onDragStart?: ((event: React.PointerEvent<HTMLElement>) => void) | undefined;
  onResizeStart: (corner: LabResizeCorner, event: React.PointerEvent<HTMLButtonElement>) => void;
  onResizeKeyDown?: ((corner: LabResizeCorner, event: React.KeyboardEvent<HTMLButtonElement>) => void) | undefined;
  onResizeKeyUp?: ((event: React.KeyboardEvent<HTMLButtonElement>) => void) | undefined;
  onRename: (title: string | null) => void; onRemove: () => void; onMenuOpened: () => void;
  onMarker?: ((marker: SectionMarker, choice: SectionMarkerChoice) => void) | undefined;
  onClearMarker?: (() => void) | undefined;
  onShift?: ((direction: "next" | "previous") => void) | undefined;
  onNewNextWeek?: (() => void) | undefined;
  onAsk?: (() => void) | undefined;
}) {
  const rootRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const editingRef = useRef(false);
  const autoNamedRef = useRef(false);
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [picker, setPicker] = useState<PickerState>(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [numberDraft, setNumberDraft] = useState("");
  const marker = markerLabel(frame);
  const hasMarker = marker !== null;
  const isWeek = isWeekPeriod({ periodStart: frame.periodStart ?? null, periodEnd: frame.periodEnd ?? null });
  const canMark = editable && Boolean(onMarker);
  function openPicker(mode: "period" | "custom" | "number", via: "menu" | "line") {
    if (!canMark) return;
    setCustomFrom(frame.periodStart ?? ""); setCustomTo(frame.periodEnd ?? "");
    setNumberDraft(frame.sequenceNo == null ? "" : String(frame.sequenceNo));
    setPicker({ mode, via });
  }
  function choosePreset(preset: "day" | "week" | "month") {
    if (!picker) return;
    const today = new Date();
    const period = preset === "day" ? dayOf(today) : preset === "week" ? weekOf(today) : monthOf(today);
    onMarker?.(setPeriodMarker(period), { kind: "period", preset, via: picker.via });
    setPicker(null);
  }
  const customValid = /^\d{4}-\d{2}-\d{2}$/.test(customFrom) && /^\d{4}-\d{2}-\d{2}$/.test(customTo) && customTo >= customFrom;
  const numberValue = Number(numberDraft);
  const numberValid = numberDraft.trim() !== "" && Number.isInteger(numberValue) && numberValue >= 0;
  function beginRename() {
    if (!editable) return;
    editingRef.current = true;
    setDraft(title ?? "");
    setRenaming(true);
  }
  useEffect(() => {
    if (!autoName || autoNamedRef.current || !editable || title !== null) return;
    autoNamedRef.current = true;
    beginRename();
  }, [autoName, editable, title]);
  useEffect(() => { if (renaming) { inputRef.current?.focus({ preventScroll: true }); inputRef.current?.select(); } }, [renaming]);
  function commit() {
    if (!editingRef.current) return;
    editingRef.current = false;
    setRenaming(false);
    onRename(sectionTitle(draft));
  }
  function press(event: React.PointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    pressRef.current = { x: event.clientX, y: event.clientY };
    onSelect();
    rootRef.current?.focus({ preventScroll: true });
    if (editable) onDragStart?.(event);
  }
  function changeMenu(open: boolean) {
    if (open && !menuOpen) onMenuOpened();
    setMenuOpen(open);
  }
  function openMenu(event: React.MouseEvent) {
    if (!editable) return;
    event.preventDefault(); event.stopPropagation(); onSelect(); changeMenu(true);
  }
  function markerLine() {
    if (!marker) return null;
    return canMark
      ? <button type="button" data-testid="section-marker-line" className="self-start text-left text-sm opacity-80 hover:underline" onPointerDown={(event) => event.stopPropagation()} onClick={() => { onSelect(); openPicker("period", "line"); }}>{marker}</button>
      : <span data-testid="section-marker-line" className="text-sm opacity-80">{marker}</span>;
  }
  /** No marker: the title renders exactly as before, with no wrapper. */
  function withMarker(node: React.ReactNode) {
    return hasMarker ? <span className="flex min-w-0 flex-col">{node}{markerLine()}</span> : node;
  }
  return <section ref={rootRef} tabIndex={0} data-testid={`lab-section-${frame.id}`} data-selected={selected}
    className="canvas-lab-section" style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
    onKeyDown={(event) => {
      if (!editable || (event.target as Element).closest("input,button")) return;
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); event.stopPropagation(); onRemove(); }
      if (event.key === "F2" || event.key === "Enter") { event.preventDefault(); event.stopPropagation(); beginRename(); }
    }}>
    {(["top", "right", "bottom", "left"] as const).map((edge) => <span key={edge} className="canvas-lab-section-edge" data-section-edge={edge} onPointerDown={press} onContextMenu={openMenu} />)}
    <div className="canvas-lab-section-title" onPointerDown={(event) => { if (!(event.target as Element).closest("input,button")) press(event); }} onContextMenu={openMenu}>
      {renaming && editable ? <input ref={inputRef} className="canvas-lab-frame-name-input" aria-label="Section title" value={draft} maxLength={60}
        onChange={(event) => setDraft(event.target.value)} onBlur={commit} onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter") { event.preventDefault(); commit(); } if (event.key === "Escape") { event.preventDefault(); editingRef.current = false; setRenaming(false); setDraft(title ?? ""); } }} />
        : title ? withMarker(<h2 onDoubleClick={beginRename}>{title}</h2>)
        : editable ? withMarker(<Button variant="ghost" className="canvas-lab-section-placeholder" onPointerDown={press} onClick={(event) => {
          const start = pressRef.current;
          pressRef.current = null;
          if (event.detail > 0 && start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 3) return;
          beginRename();
        }}>{SECTION_TITLE_PLACEHOLDER}</Button>)
        : withMarker(<span>{SECTION_TITLE_PLACEHOLDER}</span>)}
      {editable ? <DropdownMenu open={menuOpen} onOpenChange={changeMenu}><DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Section menu" className="canvas-lab-section-menu" data-visible={selected} onPointerDown={(event) => event.stopPropagation()}><MoreHorizontal /></Button>
      </DropdownMenuTrigger><DropdownMenuContent onCloseAutoFocus={(event) => { event.preventDefault(); if (!editingRef.current) rootRef.current?.focus({ preventScroll: true }); }}>
        <DropdownMenuItem onSelect={beginRename}>Rename</DropdownMenuItem>
        {onAsk ? <DropdownMenuItem onSelect={onAsk}>{SECTION_MARKER_COPY.ask}</DropdownMenuItem> : null}
        {canMark ? <>
          <DropdownMenuItem onSelect={() => openPicker("period", "menu")}>{SECTION_MARKER_COPY.setPeriod}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openPicker("number", "menu")}>{SECTION_MARKER_COPY.setNumber}</DropdownMenuItem>
          {hasMarker && onClearMarker ? <DropdownMenuItem onSelect={onClearMarker}>{SECTION_MARKER_COPY.clear}</DropdownMenuItem> : null}
          {isWeek && onShift ? <DropdownMenuItem onSelect={() => onShift("next")}>{SECTION_MARKER_COPY.shiftNext}</DropdownMenuItem> : null}
          {isWeek && onShift ? <DropdownMenuItem onSelect={() => onShift("previous")}>{SECTION_MARKER_COPY.shiftPrevious}</DropdownMenuItem> : null}
          {onNewNextWeek ? <DropdownMenuItem onSelect={onNewNextWeek}>{SECTION_MARKER_COPY.newNextWeek}</DropdownMenuItem> : null}
        </> : null}
        <DropdownMenuItem onSelect={onRemove}>Remove section</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu> : null}
    </div>
    {picker && canMark ? <div role="group" aria-label={SECTION_MARKER_COPY.pickerLabel} data-testid="section-marker-picker"
      className="absolute left-3 top-14 z-20 flex w-56 flex-col gap-2 rounded-md border border-border bg-popover p-2 text-sm text-popover-foreground shadow-md"
      style={{ pointerEvents: "auto" }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); setPicker(null); } }}>
      {picker.mode === "period" ? <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" onClick={() => choosePreset("day")}>{SECTION_MARKER_COPY.day}</Button>
        <Button size="sm" variant="outline" onClick={() => choosePreset("week")}>{SECTION_MARKER_COPY.week}</Button>
        <Button size="sm" variant="outline" onClick={() => choosePreset("month")}>{SECTION_MARKER_COPY.month}</Button>
        <Button size="sm" variant="outline" onClick={() => setPicker({ mode: "custom", via: picker.via })}>{SECTION_MARKER_COPY.custom}</Button>
      </div> : null}
      {picker.mode === "custom" ? <form className="flex flex-col gap-2" onSubmit={(event) => {
        event.preventDefault();
        if (!customValid) return;
        onMarker?.(setPeriodMarker({ periodStart: customFrom, periodEnd: customTo }), { kind: "period", preset: "custom", via: picker.via });
        setPicker(null);
      }}>
        <label className="flex flex-col gap-1">{SECTION_MARKER_COPY.from}<Input type="date" aria-label={SECTION_MARKER_COPY.from} value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label>
        <label className="flex flex-col gap-1">{SECTION_MARKER_COPY.to}<Input type="date" aria-label={SECTION_MARKER_COPY.to} value={customTo} min={customFrom || undefined} onChange={(event) => setCustomTo(event.target.value)} /></label>
        <div className="flex gap-1"><Button size="sm" type="submit" disabled={!customValid}>{SECTION_MARKER_COPY.set}</Button><Button size="sm" type="button" variant="ghost" onClick={() => setPicker(null)}>{SECTION_MARKER_COPY.cancel}</Button></div>
      </form> : null}
      {picker.mode === "number" ? <form className="flex flex-col gap-2" onSubmit={(event) => {
        event.preventDefault();
        if (!numberValid) return;
        onMarker?.(setNumberMarker(numberValue), { kind: "number", preset: "none", via: picker.via });
        setPicker(null);
      }}>
        <label className="flex flex-col gap-1">{SECTION_MARKER_COPY.number}<Input type="number" min={0} step={1} inputMode="numeric" aria-label={SECTION_MARKER_COPY.number} value={numberDraft} onChange={(event) => setNumberDraft(event.target.value)} /></label>
        <div className="flex gap-1"><Button size="sm" type="submit" disabled={!numberValid}>{SECTION_MARKER_COPY.set}</Button><Button size="sm" type="button" variant="ghost" onClick={() => setPicker(null)}>{SECTION_MARKER_COPY.cancel}</Button></div>
      </form> : null}
      {picker.mode === "period" ? <Button size="sm" variant="ghost" onClick={() => setPicker(null)}>{SECTION_MARKER_COPY.cancel}</Button> : null}
    </div> : null}
    {selected && editable ? CORNERS.map((corner) => <Button key={corner} type="button" size="icon" variant="ghost" className="canvas-lab-resize-handle" data-corner={corner} aria-label={`Resize section from ${corner}`} onPointerDown={(event) => { event.stopPropagation(); onResizeStart(corner, event); }} onKeyDown={(event) => onResizeKeyDown?.(corner, event)} onKeyUp={onResizeKeyUp} />) : null}
  </section>;
}