import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { MentionPicker } from "@/components/canvas-lab/MentionPicker";
import { Textarea } from "@/components/ui/textarea";
import { clampMentions, type Mention } from "@/lib/mention-shared";
import { insertMention, mentionsAfterEdit, mentionTrigger, type MentionCandidate } from "@/lib/mention-editor";

/** A textarea mirror measures the caret without adding markup to the body. */
function caretPosition(input: HTMLTextAreaElement) {
  const mirror = document.createElement("div");
  const style = getComputedStyle(input);
  for (const key of ["font", "lineHeight", "letterSpacing", "padding", "border", "boxSizing", "wordSpacing", "tabSize"] as const) mirror.style[key] = style[key];
  Object.assign(mirror.style, { position: "fixed", visibility: "hidden", whiteSpace: "pre-wrap", overflowWrap: "break-word", width: `${input.clientWidth}px` });
  mirror.textContent = input.value.slice(0, input.selectionStart);
  const marker = document.createElement("span"); marker.textContent = "\u200b"; mirror.append(marker); document.body.append(mirror);
  const top = marker.offsetTop - input.scrollTop + (parseFloat(style.lineHeight) || 20);
  const left = marker.offsetLeft - input.scrollLeft;
  mirror.remove();
  return { top: Math.max(0, Math.min(top, input.clientHeight)), left: Math.max(0, Math.min(left, Math.max(0, input.clientWidth - 240))) };
}

export function MentionTextEditor({ text, mentions, candidates, onChange, onDone, onKeyDown, label, placeholder, maxLength, className, initialCaret }: {
  text: string; mentions: readonly Mention[]; candidates: readonly MentionCandidate[];
  onChange: (text: string, mentions: Mention[]) => void;
  onDone?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  label: string; placeholder: string; maxLength: number; className?: string; initialCaret?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(initialCaret ?? text.length);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const pendingCaret = useRef<number | null>(initialCaret ?? text.length);
  const run = mentionTrigger(text, caret);
  // Dismissal sticks to the run start; only a new @ at another offset reopens.
  const trigger = run && run.start !== dismissedAt ? run : null;
  useLayoutEffect(() => {
    const input = ref.current; if (!input) return;
    if (pendingCaret.current !== null) { input.focus(); input.setSelectionRange(pendingCaret.current, pendingCaret.current); pendingCaret.current = null; }
    if (trigger) setPosition(caretPosition(input));
  }, [text, caret, Boolean(trigger)]);
  return <div className="relative h-full min-w-0" onPointerDown={(event) => event.stopPropagation()}>
    <Textarea ref={ref} rows={3} aria-label={label} value={text} placeholder={placeholder} maxLength={maxLength} className={className}
      onChange={(event) => { const next = event.target.value; setCaret(event.target.selectionStart); onChange(next, mentionsAfterEdit(text, next, mentions)); }}
      onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
      onBlur={(event) => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) { if (run) setDismissedAt(run.start); onDone?.(); } }}
      onKeyDown={(event) => { if (event.defaultPrevented) return; if (event.key === "Escape" && !trigger) { event.preventDefault(); onDone?.(); } onKeyDown?.(event); }} />
    {trigger ? <div className="absolute z-50 max-w-full" style={position}><MentionPicker candidates={candidates} query={trigger.query} inputRef={ref} onClose={() => setDismissedAt(trigger.start)} onPick={(person) => {
      const value = insertMention(text, mentions, trigger, person);
      if (value.text.length > maxLength) return;
      pendingCaret.current = value.caret; setCaret(value.caret); setDismissedAt(trigger.start);
      onChange(value.text, clampMentions(value.mentions, value.text.length));
    }} /></div> : null}
  </div>;
}