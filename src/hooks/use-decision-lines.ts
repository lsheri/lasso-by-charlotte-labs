import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import * as decisionsFunctions from "@/lib/decisions.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];
export type DecisionLine = Pick<DecisionRow, "id" | "document_id" | "ord" | "call_text" | "why" | "status" | "srcs">;
export const LEDGER_LINES_KEY = (documentId: string | null) => ["decision-lines", documentId] as const;
export type DecisionPassage = Database["public"]["Tables"]["span_links"]["Row"] & { transcript_title: string };
export const DECISION_PASSAGES_KEY = (documentId: string) => ["decision-passages", documentId] as const;
export function useDecisionPassages(documentId: string) {
  return useQuery({ queryKey: DECISION_PASSAGES_KEY(documentId), queryFn: async () => {
    const result = await supabase.from("span_links").select("*").eq("from_item_id", documentId).order("created_at", { ascending: true });
    if (result.error) throw result.error;
    const grouped: Record<string, DecisionPassage[]> = {};
    for (const row of result.data ?? []) {
      const locator = row.locator;
      const id = locator && typeof locator === "object" && !Array.isArray(locator) ? locator["decision_id"] : null;
      if (typeof id !== "string") continue;
      const title = row.to_item_id ? await supabase.from("work_items").select("title, display_title").eq("id", row.to_item_id).maybeSingle() : null;
      if (title?.error) throw title.error;
      (grouped[id] ??= []).push({ ...row, transcript_title: title?.data?.display_title ?? title?.data?.title ?? "" });
    }
    return grouped;
  } });
}

export function useDecisionLines(documentId: string | null) {
  return useQuery({
    queryKey: LEDGER_LINES_KEY(documentId),
    enabled: Boolean(documentId),
    queryFn: async (): Promise<DecisionLine[]> => {
      if (!documentId) return [];
      const { data, error } = await supabase.from("decisions")
        .select("id, document_id, ord, call_text, why, status, srcs")
        .eq("document_id", documentId).order("ord", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function ledgerTurnOf(line: Pick<DecisionLine, "srcs">): number | null {
  const source = Array.isArray(line.srcs) ? line.srcs[0] : null;
  const turn = source && typeof source === "object" && !Array.isArray(source) ? source["turn"] : null;
  return typeof turn === "number" && Number.isInteger(turn) && turn > 0 ? turn : null;
}

export function statusWord(status: DecisionLine["status"]): "Open" | "Agreed" | "Dropped" {
  return { draft: "Open", confirmed: "Agreed", discarded: "Dropped" }[status] as "Open" | "Agreed" | "Dropped";
}

// A failed close keeps its pending version across overlay remounts.
const dirtyDocuments = new Set<string>();
const dirtyListeners = new Map<string, Set<() => void>>();
export function markDecisionDocumentDirty(documentId: string) {
  dirtyDocuments.add(documentId);
  dirtyListeners.get(documentId)?.forEach((notify) => notify());
}
export function useDecisionLineMutations(documentId: string, profileId?: string) {
  const client = useQueryClient();
  const update = useServerFn(decisionsFunctions.updateDecisionLine);
  const add = useServerFn(decisionsFunctions.addDecisionLine);
  const version = useServerFn(decisionsFunctions.recordDecisionsVersion);
  const [pending, setPending] = useState(0);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(dirtyDocuments.has(documentId));
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(new Set<Promise<unknown>>());
  const revision = useRef(0);
  const key = LEDGER_LINES_KEY(documentId);
  const identity = { document_id: documentId, ...(profileId ? { profile_id: profileId } : {}) };
  function success() {
    revision.current += 1;
    markDecisionDocumentDirty(documentId); setDirty(true); setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1500);
  }
  // Restore can run from the board's undo path while this overlay is mounted.
  const notifyRef = useRef<() => void>(() => undefined);
  notifyRef.current = () => {
    revision.current += 1; setDirty(true); setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1500);
  };
  useEffect(() => {
    const notify = () => notifyRef.current();
    const listeners = dirtyListeners.get(documentId) ?? new Set<() => void>();
    listeners.add(notify); dirtyListeners.set(documentId, listeners);
    return () => { listeners.delete(notify); if (!listeners.size) dirtyListeners.delete(documentId); };
  }, [documentId]);
  function run<T>(id: string, operation: () => Promise<T>): Promise<T> {
    setPending((n) => n + 1); setSaved(false); setErrors((old) => ({ ...old, [id]: false }));
    const request = operation().catch((error: unknown) => {
      setErrors((old) => ({ ...old, [id]: true })); throw error;
    }).finally(() => { setPending((n) => n - 1); inFlight.current.delete(request); });
    inFlight.current.add(request);
    return request;
  }
  function editLine(id: string, patch: { call_text?: string; why?: string; status?: DecisionLine["status"] }) {
    return run(id, async () => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<DecisionLine[]>(key)?.find((line) => line.id === id);
      client.setQueryData<DecisionLine[]>(key, (rows = []) => rows.map((line) => line.id === id ? { ...line, ...patch } : line));
      try {
        const row = await update({ data: { ...identity, id, patch } });
        client.setQueryData<DecisionLine[]>(key, (rows = []) => rows.map((line) => line.id === id ? { ...line, ...patch, ...row } : line));
        success();
      } catch (error) {
        if (previous) client.setQueryData<DecisionLine[]>(key, (rows = []) => rows.map((line) => {
          if (line.id !== id) return line;
          return { ...line, ...(patch.status !== undefined ? { status: previous.status } : {}), ...(patch.call_text !== undefined ? { call_text: previous.call_text } : {}), ...(patch.why !== undefined ? { why: previous.why } : {}) };
        }));
        throw error;
      }
    });
  }
  function addLine(callText: string) {
    return run("add", async () => {
      const row = await add({ data: { ...identity, call_text: callText.trim(), status: "draft" } });
      client.setQueryData<DecisionLine[]>(key, (rows = []) => [...rows, row]);
      success(); return row;
    });
  }
  function removeLine(id: string) {
    return run(id, async () => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<DecisionLine[]>(key) ?? [];
      const ids_in_order = [...previous].sort((a, b) => Number(a.status === "discarded") - Number(b.status === "discarded") || (a.ord ?? 0) - (b.ord ?? 0)).map((line) => line.id);
      client.setQueryData<DecisionLine[]>(key, previous.filter((line) => line.id !== id));
      try {
        const row = await decisionsFunctions.removeDecisionLine({ data: { ...identity, id } });
        success(); return { documentId, row, ids_in_order };
      } catch (error) { client.setQueryData(key, previous); throw error; }
    });
  }
  function setPointer(id: string, turn: number | null) {
    return run(id, async () => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<DecisionLine[]>(key)?.find((line) => line.id === id);
      client.setQueryData<DecisionLine[]>(key, (rows = []) => rows.map((line) => line.id === id ? { ...line, srcs: turn === null ? [] : [{ turn }] } : line));
      try {
        const row = await decisionsFunctions.setDecisionPointer({ data: { ...identity, id, turn } });
        client.setQueryData<DecisionLine[]>(key, (rows = []) => rows.map((line) => line.id === id ? { ...line, ...row } : line));
        success(); return row;
      } catch (error) {
        if (previous) client.setQueryData<DecisionLine[]>(key, (rows = []) => rows.map((line) => line.id === id ? { ...line, srcs: previous.srcs } : line));
        throw error;
      }
    });
  }
  function reorderLines(ids_in_order: string[], rowId: string) {
    return run(rowId, async () => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<DecisionLine[]>(key) ?? [];
      if (previous.length !== ids_in_order.length || new Set(ids_in_order).size !== previous.length || previous.some((line) => !ids_in_order.includes(line.id))) return;
      const next = ids_in_order.flatMap((id, ord) => { const line = previous.find((entry) => entry.id === id); return line ? [{ ...line, ord: ord + 1 }] : []; });
      client.setQueryData(key, next);
      try {
        const rows = await decisionsFunctions.reorderDecisionLines({ data: { ...identity, ids_in_order } });
        client.setQueryData(key, rows); success();
      } catch (error) { client.setQueryData(key, previous); throw error; }
    });
  }
  async function saveVersion() {
    await Promise.allSettled([...inFlight.current]);
    if (!dirtyDocuments.has(documentId)) return;
    const currentRevision = revision.current;
    return run("version", async () => {
      await version({ data: identity });
      if (currentRevision === revision.current) { dirtyDocuments.delete(documentId); setDirty(false); }
      await client.invalidateQueries({ queryKey: ["document-versions", documentId] });
    });
  }
  return { setStatus: (id: string, status: DecisionLine["status"]) => editLine(id, { status }), editLine, addLine, removeLine, reorderLines, setPointer, saveVersion, dirty, pending: pending > 0, saved, errors };
}