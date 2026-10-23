import { useEffect, useId, useMemo, useState, type KeyboardEvent, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import type { MentionCandidate } from "@/lib/mention-editor";

export const COPY = { label: "Board members", empty: "No matching people" } as const;

export function MentionPicker({ candidates, query, onPick, onClose, inputRef }: {
  candidates: readonly MentionCandidate[];
  query: string;
  onPick: (candidate: MentionCandidate) => void;
  onClose: () => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const id = useId();
  const matches = useMemo(() => candidates.filter((person) => person.displayName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [candidates, query]);
  const [selection, setSelection] = useState({ query, index: 0 });
  const index = selection.query === query ? Math.min(selection.index, Math.max(0, matches.length - 1)) : 0;
  const activeId = matches[index] ? `${id}-${index}` : undefined;
  const keyDown = (event: KeyboardEvent | globalThis.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === "Escape") { onClose(); return; }
    if (event.key === "Enter") { const person = matches[index]; if (person) onPick(person); return; }
    const next = event.key === "Home" ? 0 : event.key === "End" ? matches.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % Math.max(1, matches.length);
    setSelection({ query, index: Math.max(0, next) });
  };
  useEffect(() => {
    const input = inputRef?.current;
    if (!input) return;
    input.setAttribute("aria-controls", id);
    input.setAttribute("aria-expanded", "true");
    if (activeId) input.setAttribute("aria-activedescendant", activeId); else input.removeAttribute("aria-activedescendant");
    input.addEventListener("keydown", keyDown);
    return () => { input.removeEventListener("keydown", keyDown); input.removeAttribute("aria-controls"); input.removeAttribute("aria-expanded"); input.removeAttribute("aria-activedescendant"); };
  });
  return <div id={id} role="listbox" aria-label={COPY.label} aria-activedescendant={activeId} tabIndex={0} onKeyDown={keyDown} className="max-h-48 w-60 max-w-full overflow-y-auto rounded-[var(--radius-control)] border border-border bg-card p-1 text-foreground shadow-sm">
    {matches.map((person, i) => <Button key={person.profileId} id={`${id}-${i}`} role="option" aria-selected={i === index} tabIndex={-1} variant="ghost" className={`h-auto min-h-9 w-full justify-start whitespace-normal text-left text-base ${i === index ? "bg-accent text-accent-foreground" : ""}`} onPointerDown={(event) => event.preventDefault()} onClick={() => onPick(person)}>{person.displayName}</Button>)}
    {matches.length === 0 ? <span className="block p-2 text-base text-muted-foreground">{COPY.empty}</span> : null}
  </div>;
}