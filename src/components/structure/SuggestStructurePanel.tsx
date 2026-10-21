import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoaderCircle } from "lucide-react";
import type { StructureSourceKind, SuggestedStructure } from "@/lib/structure-suggest-shared";

export const COPY = {
  heading: "Suggestions for your board",
  material: "Your material",
  placeholder: "The warehouse lease renews in June. We need a freight cost comparison and a procurement shortlist before the renewal decision.",
  helper: "Lasso reads what you paste and suggests ways to lay the board out.",
  source: "Source",
  transcript: "Transcript",
  document: "Document",
  mixed: "Mixed material",
  submit: "Suggest workstreams",
  reading: (parts?: number) => parts && parts > 1 ? `Reading your material, about ${parts} parts` : "Reading your material",
  choose: "Use this",
  cancel: "Cancel",
  retry: "Try again",
  error: "Suggestions could not be generated. Please try again.",
  shortfall: (count: number) => `Only ${count} of 3 suggestions met the naming and shape rules after one retry.`,
};

export type SuggestStructurePanelProps = {
  state: "idle" | "reading" | "choosing" | "error";
  structures: SuggestedStructure[];
  parts?: number;
  shortfall?: string | null;
  error?: string | null;
  onSubmit: (text: string, kind: StructureSourceKind) => void;
  onChoose: (structureId: string) => void;
  onCancel: () => void;
};

/** Draft inputs only. The parent owns request state, results and every side effect. */
export function SuggestStructurePanel({ state, structures, parts, shortfall, error, onSubmit, onChoose, onCancel }: SuggestStructurePanelProps) {
  const id = useId();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<StructureSourceKind>("transcript");
  const reading = COPY.reading(parts);
  return (
    <section data-lasso="on" aria-label={COPY.heading} className="min-w-0 space-y-4 font-sans text-foreground">
      <h2 className="font-serif text-xl">{COPY.heading}</h2>
      {(state === "idle" || state === "error") && (
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(text, kind); }}>
          <label htmlFor={`${id}-text`} className="block text-sm font-medium">{COPY.material}</label>
          <Textarea id={`${id}-text`} value={text} onChange={(event) => setText(event.target.value)} placeholder={COPY.placeholder} className="min-h-40 md:text-base" />
          <p className="text-base text-muted-foreground">{COPY.helper}</p>
          <Select value={kind} onValueChange={(value) => {
            if (value === "transcript" || value === "document" || value === "mixed") setKind(value);
          }}>
            <SelectTrigger aria-label={COPY.source} className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="transcript">{COPY.transcript}</SelectItem>
              <SelectItem value="document">{COPY.document}</SelectItem>
              <SelectItem value="mixed">{COPY.mixed}</SelectItem>
            </SelectContent>
          </Select>
          {state === "error" && <p role="alert" className="text-base text-destructive">{error || COPY.error}</p>}
          <Button type="submit" className="lasso-action" disabled={!text.trim()}>{state === "error" ? COPY.retry : COPY.submit}</Button>
        </form>
      )}
      {state === "reading" && (
        <div className="space-y-3">
          <p role="status" aria-live="polite" className="text-base">{reading}</p>
          <div role="progressbar" aria-label={reading}><LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" /></div>
        </div>
      )}
      {state === "choosing" && (
        <>
          {structures.length < 3 && <p role="status" className="text-base text-muted-foreground">{shortfall || COPY.shortfall(structures.length)}</p>}
          <div className="flex items-stretch gap-4 overflow-x-auto pb-2">
            {structures.map((structure) => (
              <article key={structure.id} aria-label={structure.title} className="flex min-w-0 w-64 max-w-full shrink-0 flex-col gap-3 rounded-[var(--radius-md-new)] border border-border bg-card p-4">
                <h3 className="break-words text-base font-semibold">{structure.title}</h3>
                <p className="break-words text-base text-muted-foreground">{structure.why}</p>
                <div className="mt-auto flex min-h-48 flex-col gap-2 rounded-[var(--radius-sm-new)] border border-border bg-muted p-2">
                  {structure.regions.map((region) => (
                    <div key={region} className="rounded-[var(--radius-sm-new)] border border-border bg-card p-2">
                      <p className="break-words text-sm font-medium">{region}</p>
                      <div aria-hidden="true" className="mt-2 flex gap-2">
                        {[0, 1, 2].map((card) => <span key={card} className="h-4 w-6 rounded-[var(--radius-sm-new)] border border-border bg-muted" />)}
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" onClick={() => onChoose(structure.id)}>{COPY.choose}</Button>
              </article>
            ))}
          </div>
        </>
      )}
      <Button type="button" variant="ghost" onClick={onCancel}>{COPY.cancel}</Button>
    </section>
  );
}