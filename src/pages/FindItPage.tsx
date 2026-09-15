import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { NotebookSpider } from "@/components/notebook/NotebookSpider";
import { ToneCard } from "@/components/notebook/ToneCard";
import { shimmerStyle } from "@/components/motion/ChatShimmer";
import { WorkNote } from "@/components/work/WorkNote";
import { ThreadViewerById } from "@/components/work/ThreadViewerById";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useReducedMotion } from "@/hooks/use-motion";
import { useWorkItems } from "@/hooks/use-work-items";
import { findCandidates } from "@/lib/find-it";
import { isDeliverableType } from "@/lib/lineage-shared";
import { effectiveWorkDate, type WorkItemRow } from "@/lib/work-types";

/**
 * A first attempt, not a finished feature. The matching behind it is a
 * placeholder (see src/lib/find-it.ts) and the destination button is inert.
 * Deliberately no telemetry: the words for this are not settled yet.
 */

/** The run always reads as a real look through the chats, never a flicker. */
const MIN_RUN_MS = 8000;

function isConversation(item: WorkItemRow): boolean {
  return item.type === "ai_thread";
}

/** What can be traced: the finished things, plus call transcripts. */
function isTraceable(item: WorkItemRow): boolean {
  return isDeliverableType(item.type) || item.type === "call";
}

export function FindItPage() {
  const { data, isLoading } = useWorkItems();
  const reduceMotion = useReducedMotion();
  const items = useMemo(() => data?.items ?? [], [data]);

  const chats = useMemo(() => items.filter(isConversation), [items]);
  const traceable = useMemo(() => items.filter(isTraceable), [items]);

  const [targetId, setTargetId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [running, setRunning] = useState(false);
  const [ranAt, setRanAt] = useState<number | null>(null);
  const [threshold, setThreshold] = useState(25);
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [openThread, setOpenThread] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const target = useMemo(
    () => traceable.find((item) => item.id === targetId) ?? null,
    [traceable, targetId],
  );

  const visibleChats = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return chats;
    return chats.filter((chat) => chat.title.toLowerCase().includes(needle));
  }, [chats, filter]);

  const candidates = useMemo(() => {
    if (!target || !ranAt) return [];
    return findCandidates(
      { id: target.id, title: target.title, date: effectiveWorkDate(target) },
      chats.map((chat) => ({
        id: chat.id,
        title: chat.title,
        date: effectiveWorkDate(chat),
      })),
    );
  }, [target, ranAt, chats]);

  const shown = candidates.filter(
    (candidate) => !dropped.has(candidate.chatId) && candidate.score * 100 >= threshold,
  );

  function run() {
    if (!target || running) return;
    setDropped(new Set());
    setDeselected(new Set());
    setRanAt(null);
    setRunning(true);
    // The placeholder scorer is instant; the look through is held to its full
    // length on purpose rather than cut short.
    timer.current = setTimeout(() => {
      setRunning(false);
      setRanAt(Date.now());
    }, MIN_RUN_MS);
  }

  return (
    <div>
      <PageHeader
        title="Find it"
        subtitle="Point at a finished piece of work, and look back through your conversations for the ones that fed it."
      />

      <ToneCard tone="attention" label="FIRST ATTEMPT" className="mb-8 gap-2 p-4">
        <p>
          This page is an early sketch. The matching behind it is a stand-in, so treat what it
          offers as a suggestion to look at, never as an answer.
        </p>
      </ToneCard>

      <section className="mb-10">
        <SectionHeader title="What are you tracing?" />
        {target ? (
          <div className="mt-3 flex flex-wrap items-start gap-3">
            <div className="w-[240px]">
              <WorkNote item={target} />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setTargetId(null)}>
              Choose something else
            </Button>
          </div>
        ) : (
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              toast("Bringing in new files from here is coming. For now, pick something you already have.");
            }}
            className="mt-3 grid min-h-[140px] place-items-center rounded-[8px] border border-dashed border-pencil bg-card px-6 py-8 text-center"
          >
            <div>
              <p className="text-sm text-muted-foreground">
                Drop a finished piece of work here, or pick one you already have.
              </p>
              <Button
                type="button"
                className="mt-3"
                onClick={() => setPickerOpen(true)}
                disabled={isLoading}
              >
                Pick a piece of work
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="mb-6">
        <div className="relative">
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="What was this built from?"
            aria-label="Filter your conversations"
            className="h-12 pr-[68px] text-[13px]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 opacity-70 sm:block"
          >
            <NotebookSpider size={44} />
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={run} disabled={!target || running}>
            {running ? "Looking…" : "Find it"}
          </Button>
          {!target ? (
            <span className="text-[11.5px] text-muted-foreground">
              Choose a piece of work first.
            </span>
          ) : null}
          {running && reduceMotion ? (
            <span className="text-[11.5px] text-muted-foreground">
              Looking through the conversations.
            </span>
          ) : null}
        </div>
      </section>

      <section className="mb-12">
        <SectionHeader title="Your conversations" />
        {visibleChats.length === 0 && !isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No conversations to look through yet.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-3">
          {visibleChats.map((chat, index) => (
            <div
              key={chat.id}
              className={running && !reduceMotion ? "nb-chat-shimmer w-[220px] rounded-[6px]" : "w-[220px]"}
              style={running && !reduceMotion ? shimmerStyle(index) : undefined}
            >
              <WorkNote item={chat} onOpen={() => setOpenThread(chat.id)} />
            </div>
          ))}
        </div>
      </section>

      {ranAt ? (
        <section>
          <SectionHeader title="What it found" />
          <div className="mt-3 max-w-md">
            <p className="micro-label">How close a match?</p>
            <Slider
              value={[threshold]}
              onValueChange={(next) => setThreshold(next[0] ?? 0)}
              min={0}
              max={100}
              step={5}
              aria-label="How close a match?"
              className="mt-2"
            />
            <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
              <span>Loose</span>
              <span>Exact</span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {shown.map((candidate) => {
              const chat = chats.find((item) => item.id === candidate.chatId);
              if (!chat) return null;
              const off = deselected.has(chat.id);
              return (
                <div key={chat.id} className={off ? "w-[240px] opacity-50" : "w-[240px]"}>
                  {/* TODO: turn level highlighting attaches here — the next piece
                      is marking which turns in this conversation fed the work. */}
                  <WorkNote item={chat} onOpen={() => setOpenThread(chat.id)} />
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                      {Math.round(candidate.score * 100)}%
                    </span>
                    <span className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDeselected((prev) => {
                            const next = new Set(prev);
                            if (next.has(chat.id)) next.delete(chat.id);
                            else next.add(chat.id);
                            return next;
                          })
                        }
                      >
                        {off ? "Keep" : "Deselect"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDropped((prev) => new Set(prev).add(chat.id))}
                      >
                        Remove
                      </Button>
                    </span>
                  </div>
                </div>
              );
            })}
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing that close. Loosen the slider to see more.
              </p>
            ) : null}
          </div>

          <div className="mt-8">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button type="button" disabled>
                      Add these to…
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Choosing a destination is coming next.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </section>
      ) : null}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pick a piece of work</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {traceable.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTargetId(item.id);
                  setRanAt(null);
                  setPickerOpen(false);
                }}
                className="block w-full truncate rounded-md px-2 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-accent-soft"
              >
                {item.title}
              </button>
            ))}
            {traceable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing to trace yet. Documents, decks, sheets and call transcripts appear here.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <ThreadViewerById workItemId={openThread} onClose={() => setOpenThread(null)} />
    </div>
  );
}
