import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { deskDate } from "@/lib/proposal-desk-shared";
import { FINAL_COPY, type ChooseFinalResult, type DraftFinalResult, type FinalSource, type FinalView } from "@/lib/proposal-final-shared";

/** What the block can do. Each is the server's call; the block only draws and says what came back. */
export type FinalTools = {
  choose: (proposalId: string, itemId: string, source: FinalSource) => Promise<ChooseFinalResult>;
  draft: (proposalId: string) => Promise<DraftFinalResult>;
  /** Uploads files as the person's own work; answers the new item ids and what did not come in. */
  upload: (files: File[]) => Promise<{ ids: string[]; failures: { name: string; reason: string }[] }>;
};

/**
 * 21 Nov 2026, chat pill PR 4c (D-97): "Decide the final proposal" on the Lead's Up next row. Upload the final, draft
 * it from the brief (no board needed), or use one of the documents the owner sent. Choosing again replaces it; the
 * earlier choice stays in the record. Every press works once, and says plainly what failed.
 */
export function LeadFinalBlock({
  proposalId,
  final,
  documents,
  tools,
  now,
}: {
  proposalId: string;
  final: FinalView | null | undefined;
  /** The documents the Lead may open (sent by the owner), to use one as the final. */
  documents: readonly { id: string; title: string }[];
  tools: FinalTools;
  now?: Date | undefined;
}) {
  const C = FINAL_COPY;
  const [chosen, setChosen] = useState<FinalView | null>(final ?? null);
  const [busy, setBusy] = useState<"upload" | "draft" | "choose" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ itemId: string; title: string; gaps: number; questions: number } | null>(null);
  const file = useRef<HTMLInputElement | null>(null);
  const shown = chosen ?? final ?? null;

  async function choose(itemId: string, source: FinalSource) {
    if (busy) return;
    setBusy("choose");
    setProblem(null);
    try {
      const result = await tools.choose(proposalId, itemId, source);
      if (result.ok) {
        setChosen(result.final);
        setNote(C.changed);
        if (source === "draft") setDraft(null);
      } else setProblem(result.problem);
    } catch {
      setProblem(C.failed);
    } finally {
      setBusy(null);
    }
  }

  async function upload(files: File[]) {
    if (busy || files.length === 0) return;
    setBusy("upload");
    setProblem(null);
    try {
      const { ids, failures } = await tools.upload(files.slice(0, 1));
      if (!ids[0]) return setProblem(C.uploadFailed(failures[0]?.reason ?? C.failed));
      setBusy(null);
      await choose(ids[0], "upload");
    } catch {
      setProblem(C.uploadFailed(C.failed));
    } finally {
      setBusy(null);
      if (file.current) file.current.value = "";
    }
  }

  async function makeDraft() {
    if (busy) return;
    setBusy("draft");
    setProblem(null);
    try {
      const result = await tools.draft(proposalId);
      if (result.ok) setDraft({ itemId: result.itemId, title: result.title, gaps: result.gaps, questions: result.questions });
      else setProblem(result.problem);
    } catch {
      setProblem(C.draftFailed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div data-led-final={shown ? "chosen" : "none"} className="flex flex-col gap-2 text-(length:--type-small)">
      <p className="font-medium text-foreground">{C.heading}</p>
      <p data-led-final-line className="break-words text-muted-foreground [overflow-wrap:anywhere]">
        {shown ? C.chosen(shown.title || "Untitled", deskDate(shown.chosenAt, now)) : C.none}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          ref={file}
          type="file"
          className="sr-only"
          aria-label={C.upload}
          data-led-final-file
          accept=".pdf,.doc,.docx,.txt,.md,.ppt,.pptx"
          onChange={(event) => void upload([...(event.currentTarget.files ?? [])])}
        />
        <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => file.current?.click()}>
          {busy === "upload" ? C.uploading : C.upload}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void makeDraft()}>
          {busy === "draft" ? C.drafting : C.draft}
        </Button>
      </div>
      {draft ? (
        <div data-led-final-draft className="flex flex-col gap-1 rounded-[var(--radius-control)] border border-border px-3 py-2">
          <p className="break-words text-foreground [overflow-wrap:anywhere]">{C.draftReady(draft.title)}</p>
          <p className="text-muted-foreground">{C.draftGaps(draft.gaps, draft.questions)}</p>
          <Button type="button" size="sm" className="self-start" disabled={busy !== null} onClick={() => void choose(draft.itemId, "draft")}>
            {C.useDraft}
          </Button>
        </div>
      ) : null}
      {documents.length ? (
        <ul className="flex flex-col gap-1">
          {documents.map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                className="text-left text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                aria-label={C.useDocument(doc.title)}
                disabled={busy !== null || shown?.itemId === doc.id}
                onClick={() => void choose(doc.id, "document")}
              >
                {C.useDocument(doc.title)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {note && !problem ? (
        <p role="status" className="text-muted-foreground">
          {note}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
