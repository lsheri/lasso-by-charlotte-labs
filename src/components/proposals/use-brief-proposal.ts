import { useEffect, useRef, useState } from "react";

import type { BriefReading } from "@/lib/brief-read-shared";
import { FIRM_BRAIN_LIMIT_COPY, isFirmBrainLimit } from "@/lib/firm-brain-limit-shared";
import {
  BRIEF_PASS_COPY,
  draftFrom,
  draftReady,
  PROPOSAL_CARD_COPY as COPY,
  PROPOSAL_REVEAL_STEP_MS,
  proposalInput,
  type BriefAdmins,
  type BriefDraft,
  type BriefPassResult,
} from "@/lib/pill-proposal-shared";
import type { DeskClient, NewProposalRaw, NewProposalResult } from "@/lib/proposal-desk-shared";

/** What starting a proposal from a brief needs from the app: the same server calls in the chat and on a step card. */
export type BriefProposalTools = {
  profileId: string;
  read: (text: string) => Promise<BriefReading>;
  clients: () => Promise<DeskClient[]>;
  capture: (files: File[]) => Promise<{ ids: string[]; failures: { name: string; reason: string }[] }>;
  discard: (ids: string[]) => Promise<void>;
  create: (input: NewProposalRaw) => Promise<NewProposalResult>;
};

export type BriefStage = "idle" | "reading" | "check" | "starting" | "lead" | "landed" | "readFailed";

export type BriefDoc = { id: string; name: string; file: File };

/** The four captions a reading shows, one after another, so the wait says what is happening. */
export const BRIEF_READ_STEPS = [COPY.reading, COPY.askStep, COPY.dueStep, COPY.checkStep] as const;

/**
 * 21 Nov 2026, click path cards (Liam: "clicking through version not using chat should have buttons that pop open
 * pleasant looking white background cards for steps"). The brief-to-proposal flow, lifted out of the chat's proposal
 * card so the chat and the step card run the very same code: read the paste (the model proposes, code keeps only what
 * the paste says word for word), let the person check the client, the ask and the due date, hold documents in the
 * browser until Start, then start the proposal through New proposal's own call. Nothing is saved before Start; a start
 * that fails removes what it uploaded.
 */
export function useBriefProposal(tools: BriefProposalTools, reduceMotion: boolean) {
  const [stage, setStage] = useState<BriefStage>("idle");
  const [step, setStep] = useState(0);
  const [reading, setReading] = useState<BriefReading | null>(null);
  const [draft, setDraft] = useState<BriefDraft>({ client: "", ask: "", dueOn: "", workItemIds: [] });
  // QA M2 of PR 296: documents stay in the browser until Start, so a card left behind leaves nothing in the person's work.
  const [docs, setDocs] = useState<BriefDoc[]>([]);
  const [clients, setClients] = useState<DeskClient[]>([]);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const nextDoc = useRef(1);
  // A read that comes back after the person moved on (typed it in themselves, or read again) is dropped.
  const readNo = useRef(0);
  // The fields were opened for typing (a step card), so a read is help, never a gate.
  const typed = useRef(false);

  /** Reads the paste, with the captions in front of the wait. */
  async function begin(text: string) {
    const mine = ++readNo.current;
    setStage("reading");
    setStep(0);
    setProblem(null);
    const reveal = (async () => {
      if (reduceMotion) return;
      for (let i = 1; i < BRIEF_READ_STEPS.length; i += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, PROPOSAL_REVEAL_STEP_MS));
        if (mine !== readNo.current) return;
        setStep(i);
      }
      await new Promise((resolve) => window.setTimeout(resolve, PROPOSAL_REVEAL_STEP_MS));
    })();
    try {
      const [read, list] = await Promise.all([tools.read(text), tools.clients().catch(() => [] as DeskClient[])]);
      await reveal;
      if (mine !== readNo.current) return;
      setReading(read);
      setClients(list);
      // What the person already typed stays; the brief fills only what is still empty.
      const found = draftFrom(read);
      setDraft((d) => ({
        ...d,
        client: d.client.trim() ? d.client : found.client,
        ask: d.ask.trim() ? d.ask : found.ask,
        dueOn: d.dueOn || found.dueOn,
      }));
      setStage("check");
    } catch (error) {
      await reveal;
      if (mine !== readNo.current) return;
      setProblem(isFirmBrainLimit(error) ? FIRM_BRAIN_LIMIT_COPY.shown : COPY.readFailed);
      // On a step card the fields are already there to type in, so a failed read leaves them open with the reason.
      setStage(typed.current ? "check" : "readFailed");
    }
  }

  /** No brief to paste: the same check, with every field empty for the person to fill in. Nothing is read. */
  async function blank(notes = "") {
    ++readNo.current;
    setProblem(null);
    typed.current = true;
    setReading({ client: null, ask: null, due: null, notes, readBy: "code" });
    setStage("check");
    const list = await tools.clients().catch(() => [] as DeskClient[]);
    setClients(list);
  }

  function add(files: File[]) {
    if (!files.length || stage !== "check") return;
    setProblem(null);
    setDocs((list) => [...list, ...files.map((file) => ({ id: `doc-${nextDoc.current++}`, name: file.name, file }))].slice(0, 12));
  }

  function removeDoc(id: string) {
    setDocs((list) => list.filter((doc) => doc.id !== id));
  }

  /** Uploads the documents for Start. All or nothing: any failure removes what did upload and says which one. */
  async function upload(): Promise<string[] | null> {
    const ids: string[] = [];
    const failed: string[] = [];
    for (let i = 0; i < docs.length; i += 1) {
      setUploading({ done: i, total: docs.length });
      try {
        const id = (await tools.capture([docs[i]!.file])).ids[0];
        if (id) ids.push(id);
        else failed.push(docs[i]!.name);
      } catch {
        failed.push(docs[i]!.name);
      }
    }
    setUploading(null);
    if (!failed.length) return ids;
    if (ids.length) await tools.discard(ids).catch(() => undefined);
    setProblem(COPY.docsFailed(failed.join(", ")));
    return null;
  }

  /** Starts the proposal. Returns its id, or null when it did not start (the reason is in `problem`). */
  async function start(next: "lead" | "landed", notes?: string): Promise<string | null> {
    if (stage !== "check" || !reading || !draftReady(draft) || uploading) return null;
    setStage("starting");
    setProblem(null);
    let ids: string[] = [];
    try {
      const uploaded = await upload();
      if (!uploaded) {
        setStage("check");
        return null;
      }
      ids = uploaded;
      const result = await tools.create(proposalInput({ ...draft, workItemIds: ids }, notes ?? reading.notes, clients, tools.profileId));
      if (!result.ok) {
        if (ids.length) await tools.discard(ids).catch(() => undefined);
        setProblem(result.problem);
        setStage("check");
        return null;
      }
      setProposalId(result.id);
      setStage(next);
      return result.id;
    } catch {
      if (ids.length) await tools.discard(ids).catch(() => undefined);
      setProblem(COPY.failed);
      setStage("check");
      return null;
    }
  }

  return {
    stage,
    setStage,
    step,
    reading,
    draft,
    setDraft,
    docs,
    clients,
    uploading,
    problem,
    proposalId,
    ready: draftReady(draft),
    begin,
    blank,
    add,
    removeDoc,
    start,
  };
}

/** Today as a date input's value, so a due date in the past cannot be picked (QA L of PR 296). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type BriefPassTools = {
  admins: () => Promise<BriefAdmins>;
  pass: (text: string) => Promise<BriefPassResult>;
};

/**
 * A Member's brief, passed to the admins: who would be told is read first, and the brief goes only on the press.
 * The chat's pass card and the step card share it.
 */
export function useBriefPass(tools: BriefPassTools, enabled = true) {
  const [admins, setAdmins] = useState<BriefAdmins | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    tools
      .admins()
      .then((found) => live && setAdmins(found))
      .catch(() => live && setAdmins({ name: null, count: 0 }));
    return () => {
      live = false;
    };
  }, [tools, enabled]);

  async function tell(text: string) {
    if (state !== "idle") return;
    setState("sending");
    setProblem(null);
    try {
      const result = await tools.pass(text);
      if (result.ok) setState("sent");
      else {
        setProblem(result.problem);
        setState("idle");
      }
    } catch {
      setProblem(BRIEF_PASS_COPY.failed);
      setState("idle");
    }
  }

  return { admins, name: admins?.name ?? null, state, problem, tell, noAdmin: admins !== null && admins.count === 0 };
}
