import { Link } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

import { noteWorkboardContextChanged } from "@/components/canvas-lab/canvas-lab-telemetry";
import { useSlashMenu } from "./use-slash-menu";

import { CoverageNote } from "@/components/reflect/CoverageNote";
import { GraphiteIcon, type GraphiteIconName } from "@/components/notebook/icons";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { AnswerRail, ContextAudit, ThinkingTrail } from "@/components/reflect/ContextTrail";
import { AnswerMoreMenu } from "@/components/reflect/AnswerMoreMenu";
import { SaveForOneOnOneDialog } from "@/components/oneonone/SaveForOneOnOne";
import { Button } from "@/components/ui/button";
import { MappedWorkChecklist } from "@/components/reflect/MappedWorkChecklist";
import { Textarea } from "@/components/ui/textarea";
import { parseManifest } from "@/lib/context-manifest";
import { ArtifactNote, SourceMark } from "@/components/work/SourceMark";
import { TypeBadge } from "@/components/work/TypeIcon";
import { useAnswerKeep } from "@/components/reflect/answer-keep-context";
import { ANSWER_DRAG_MIME, KEEP_ANSWER_LABEL } from "@/lib/answer-card";
import type { AskTab } from "@/components/reflect/ask-dock-state";
import type { AskLasso } from "@/components/reflect/use-ask-lasso";
import { LassoThinkingMark } from "@/components/reflect/LassoThinkingMark";
import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { LOOP_SIZE_CHAT } from "@/lib/lasso-loop";

/** Three grey dots used by compact loading and sending states inside Ask Lasso. */
export function NbDots({ label = "Thinking" }: { label?: string }) {
  return (
    <span className="nb-dots" role="status" aria-label={label}>
      <span className="nb-dot" />
      <span className="nb-dot" />
      <span className="nb-dot" />
    </span>
  );
}

const TABS: { id: AskTab; label: string; icon: GraphiteIconName }[] = [
  { id: "messages", label: "Messages", icon: "messages" },
  { id: "history", label: "History", icon: "history" },
];

/**
 * Two panels and one action. "New chat" sits in the same row because that is
 * where people look for it, but it is a button, not a tab: it never holds
 * selection, it starts a fresh session and lands you on Messages.
 */
export function AskTabs({
  tab,
  onTab,
  onNewChat,
}: {
  tab: AskTab;
  onTab: (tab: AskTab) => void;
  onNewChat?: (() => void) | undefined;
}) {
  return (
    <div className="nb-ask-tabs" role="tablist" aria-label="Ask Lasso">
      {TABS.map((entry) => (
        <button
          key={entry.id}
          type="button"
          role="tab"
          aria-selected={tab === entry.id}
          onClick={() => onTab(entry.id)}
          className="nb-ask-tab"
        >
          <GraphiteIcon name={entry.icon} size={16} />
          <span>{entry.label}</span>
        </button>
      ))}
      {onNewChat ? (
        <button type="button" role="button" onClick={onNewChat} className="nb-ask-tab">
          <GraphiteIcon name="plus" size={16} />
          <span>New chat</span>
        </button>
      ) : null}
    </div>
  );
}

/** True when the chat's scope was narrowed by cards picked on the board. */
export const AskBoardPickedContext = createContext(false);

/** The scope chip: what Lasso will read on the next message. */
export function AskScopeChip({ ask, block, workstream }: { ask: AskLasso; block?: boolean; workstream?: { name: string; ids: string[] } | null }) {
  const boardPicked = useContext(AskBoardPickedContext);
  const onWorkstream =
    workstream != null &&
    ask.selectedItems.length === workstream.ids.length &&
    ask.selectedItems.every((i) => workstream.ids.includes(i.id));
  const label =
    ask.draftPointed.length > 0
      ? `Pointed at: ${ask.draftPointed.length} ${ask.draftPointed.length === 1 ? "item" : "items"}`
      : onWorkstream
        ? `Workstream: ${workstream.name}`
        : boardPicked && ask.boardPickedCount === 0
          ? "Brief only: nothing picked has work to read"
        : boardPicked
          ? `${ask.boardPickedCount} picked on the board`
        : ask.selectedItems.length === ask.mapped.length
        ? "All work in this engagement"
          : ask.selectedItems.length === 1
          ? "1 piece of work selected"
          : `${ask.selectedItems.length} pieces of work selected`;
  return (
    <button
      type="button"
      onClick={() => ask.setPickerOpen(!ask.pickerOpen)}
      className={
        block
          ? "flex min-h-12 w-full items-center justify-between gap-2 border-t border-border bg-secondary/50 px-4 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-accent-deep"
          : "inline-flex max-w-full items-center gap-2 rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-deep"
      }
    >
      <span className="truncate">{label}</span>
      <span className="shrink-0 text-muted-foreground">{ask.pickerOpen ? "Hide" : "Change"}</span>
    </button>
  );
}

function WorkPicker({ ask, engagementId }: { ask: AskLasso; engagementId: string }) {
  if (!ask.pickerOpen) return null;
  const checked = new Set(ask.selectedItems.map((i) => i.id));
  return (
    <div className="max-h-56 space-y-3 overflow-y-auto border-b border-border bg-secondary/40 px-4 py-3">
      <MappedWorkChecklist
        items={ask.mapped}
        engagementId={engagementId}
        checked={checked}
        onToggle={(id) =>
          ask.setSelected((prev) => {
            const next = new Set(prev ?? ask.mapped.map((i) => i.id));
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
        empty="No work is mapped into this engagement yet."
      />
      <p className="text-xs text-muted-foreground">
        Only work you have mapped appears here. Private and unmapped work stays out.
      </p>
    </div>
  );
}

/** The transcript, on binder paper. Every line sits on the 28px pitch. */
function MessagesTab({ ask, emptyActions }: { ask: AskLasso; emptyActions?: React.ReactNode }) {
  const messages = ask.messages ?? [];
  const viewerInitial = ask.profile?.display_name.trim().charAt(0).toUpperCase() || "Y";
  // Only the workboard offers a place to keep an answer, and only to someone
  // who may arrange that board.
  const keep = useAnswerKeep();
  // Dragging an answer onto the board is for a fine pointer on a wide screen.
  const isMobile = useIsMobile();
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(pointer: coarse)");
    setCoarse(query.matches);
    const onChange = () => setCoarse(query.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);
  const canDragAnswer = !!keep && !isMobile && !coarse;

  function shortTime(value: string | Date): string {
    return new Date(value).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function speakerAvatar(role: "user" | "assistant") {
    const assistant = role === "assistant";
    if (assistant) {
      return <LassoLoopMark className="size-7 shrink-0 text-lasso-green" />;
    }
    return (
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full border border-mid bg-grey-1 text-[11px] font-semibold text-mid"
      >
        {viewerInitial}
      </span>
    );
  }

  function speakerName(role: "user" | "assistant", time: string | Date) {
    const assistant = role === "assistant";
    const dateTime = typeof time === "string" ? time : time.toISOString();
    return (
      <span className="nb-binder-line flex min-w-0 items-baseline gap-2">
        <span className="font-sans text-[13px] font-semibold text-ink">
          {assistant ? "Lasso" : "You"}
        </span>
        <time className="text-[11px] text-soft" dateTime={dateTime} suppressHydrationWarning>
          {shortTime(time)}
        </time>
      </span>
    );
  }

  return (
    <div className="nb-binder min-h-0 flex-1 overflow-y-auto">
      <div className="nb-binder-body px-4 sm:px-5">
        {messages.length === 0 ? (
          <>
            <p className="nb-binder-line text-sm text-foreground">
              Ask about this engagement. Private to you, your coach never sees this.
            </p>
            <div className="nb-binder-inset mt-[1.75rem] space-y-[1.75rem]">
              <p className="text-sm text-foreground">
                Try: what did I decide here, and what did I decide it on?
              </p>
              <p className="text-sm text-foreground">
                Try: where has this engagement drifted from the brief?
              </p>
            </div>
            {emptyActions}
          </>
        ) : null}

        {messages.map((message, index) => {
          const role = message.role === "user" ? "user" : "assistant";
          const previous = messages[index - 1];
          const followsSameSpeaker =
            previous !== undefined && (previous.role === "user" ? "user" : "assistant") === role;

          return (
            <div
              key={message.id}
              className="nb-conversation-message max-w-none flex-row items-start gap-3"
            >
              <div className="grid w-7 shrink-0 grid-rows-[28px]">
                {followsSameSpeaker ? <span aria-hidden className="size-7" /> : speakerAvatar(role)}
              </div>
              <div className="nb-conversation-body w-full flex-1 gap-0 overflow-visible">
                {!followsSameSpeaker ? speakerName(role, message.created_at) : null}
                {message.role === "user" ? (
                  <p className="nb-binder-line whitespace-pre-wrap text-sm text-foreground">
                    {message.content}
                  </p>
                ) : (
                  <AnswerRail state="done">
                    <MarkdownMessage content={message.content} variant="binder" />
                    <div className="nb-binder-inset">
                      <ContextAudit
                        manifest={parseManifest(message.context_manifest)}
                        reads={ask.sourcesByMessage?.[Number(message.id)] ?? []}
                      />
                      <div className="mt-1 flex items-center" data-testid="answer-actions">
                      {keep && !ask.pending ? (
<>
                        <button
                          type="button"
                          onClick={() =>
                            keep(
                              {
                                messageId: Number(message.id),
                                text: message.content,
                                reads: (ask.sourcesByMessage?.[Number(message.id)] ?? []).map((source) => ({
                                  id: source.id,
                                  depth: source.depth,
                                })),
                              },
                              "button",
                            )
                          }
                          className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {KEEP_ANSWER_LABEL}
                        </button>
                        {canDragAnswer ? (
                          <span
                            role="button"
                            tabIndex={-1}
                            draggable
                            aria-label="Drag onto the board"
                            title="Drag onto the board"
                            data-testid="answer-drag-grip"
                            onDragStart={(event) => {
                              const payload = {
                                messageId: Number(message.id),
                                text: message.content,
                                reads: (ask.sourcesByMessage?.[Number(message.id)] ?? []).map((source) => ({
                                  id: source.id,
                                  depth: source.depth,
                                })),
                              };
                              event.dataTransfer.setData(ANSWER_DRAG_MIME, JSON.stringify(payload));
                              event.dataTransfer.effectAllowed = "copy";
                              document.body.dataset["answerDrag"] = "true";
                            }}
                            onDragEnd={() => {
                              delete document.body.dataset["answerDrag"];
                            }}
                            className="ml-1 inline-flex cursor-grab items-center align-middle text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
                          >
                            <GraphiteIcon name="drag-handle" size={14} />
                          </span>
                        ) : null}
                        </>
                      ) : null}
                        <AnswerMoreMenu
                          onSave={() =>
                            ask.setSaveTarget({
                              text: message.content,
                              kind: "chat_excerpt",
                              sessionId: ask.sessionId,
                            })
                          }
                        />
                      </div>
                    </div>
                  </AnswerRail>
                )}
              </div>
            </div>
          );
        })}

        {(() => {
          // Shown on send, before the server answers. Hidden once the saved
          // copy of the same question is back in the thread.
          const asked = (ask as AskLasso & { asked?: string | null }).asked;
          const last = messages[messages.length - 1];
          if (!ask.pending || !asked || (last?.role === "user" && last.content === asked)) return null;
          return (
            <div className="nb-conversation-message max-w-none flex-row items-start gap-3" data-testid="asked-now">
              <div className="grid w-7 shrink-0 grid-rows-[28px]">{speakerAvatar("user")}</div>
              <div className="nb-conversation-body w-full flex-1 gap-0 overflow-visible">
                {speakerName("user", new Date())}
                <p className="nb-binder-line whitespace-pre-wrap text-sm text-foreground">{asked}</p>
              </div>
            </div>
          );
        })()}

        {ask.pending ? (
          <div className="nb-binder-line flex items-center gap-2">
            <LassoThinkingMark kind="gather" size={56} count={ask.liveManifest?.items.length ?? 0} />
            <span className="text-sm text-muted-foreground">
              {ask.streamed ? "Writing" : "Reading your work"}
            </span>
          </div>
        ) : null}

        {ask.pending ? (
          <div className="nb-conversation-message max-w-none flex-row items-start gap-3">
            <div className="grid w-7 shrink-0 grid-rows-[28px]">{speakerAvatar("assistant")}</div>
            <div className="nb-conversation-body w-full flex-1 gap-0 overflow-visible">
              {speakerName("assistant", new Date())}
              <AnswerRail state="working">
                {ask.streamed ? (
                  <MarkdownMessage content={ask.streamed} variant="binder" className="nb-stream" />
                ) : (
                  <div className="nb-binder-inset">
                    <ThinkingTrail
                      items={(ask.pointedNow.length > 0 ? ask.pointedNow : ask.selectedItems).map(
                        (item) => ({ id: item.id, title: item.title }),
                      )}
                      finalPhase="Writing"
                      manifest={ask.liveManifest}
                      lead={ask.pointedNow.length > 0 ? "Reading what you pointed at" : undefined}
                    />
                  </div>
                )}
              </AnswerRail>
            </div>
          </div>
        ) : null}

        {ask.coverage?.truncated ? (
          <div className="nb-binder-inset">
            <CoverageNote {...ask.coverage} />
          </div>
        ) : null}
        <div ref={ask.bottomRef} />
      </div>
    </div>
  );
}

/** Only the chats that belong to this engagement, and nothing until we know. */
const HISTORY_DEFAULT_SHOWN = 2;

function HistoryTab({ ask }: { ask: AskLasso }) {
  const [expanded, setExpanded] = useState(false);
  const sessions = ask.sessions ?? [];
  const shown = expanded ? sessions : sessions.slice(0, HISTORY_DEFAULT_SHOWN);

  return (
    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4">
      <button
        type="button"
        onClick={ask.newSession}
        className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
      >
        New session
      </button>
      {!ask.historySettled ? (
        <div className="flex items-center gap-2 py-2">
          <NbDots label="Loading earlier sessions" />
          <span className="text-sm text-muted-foreground">Finding this engagement's chats</span>
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No earlier chats on this engagement yet.</p>
      ) : (
        <>
          {shown.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => ask.openSession(row.id)}
              className={`block min-h-11 w-full truncate text-left text-sm transition-colors hover:text-foreground ${
                row.id === ask.sessionId ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {row.title ?? "Untitled"}{" "}
              <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
                {new Date(row.created_at).toLocaleDateString()}
              </span>
            </button>
          ))}
          {sessions.length > HISTORY_DEFAULT_SHOWN ? (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 flex min-h-11 w-full items-center gap-1.5 rounded-[var(--radius-control)] border border-border px-3 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <GraphiteIcon
                name="chevron-right"
                size={14}
                className={expanded ? "rotate-[-90deg]" : "rotate-90"}
              />
              <span>{expanded ? "Show fewer chats" : `Show all ${sessions.length} chats`}</span>
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

/** The composer, scope chip and send. Send is the one filled green here. */
export function AskComposer({ ask, mobile, engagementId, orgId }: { ask: AskLasso; mobile?: boolean; engagementId: string; orgId?: string }) {
  const slash = useSlashMenu(ask, engagementId, () => noteWorkboardContextChanged(orgId, "workstream"));
  return (
    <footer className="shrink-0 border-t border-border bg-card">
      {mobile ? <AskScopeChip ask={ask} block workstream={slash.chosen} /> : null}
      <div className="px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        {slash.open ? (
          <div role="listbox" aria-label="Workstreams" className="mb-2 max-h-52 w-full max-w-full overflow-y-auto overscroll-contain rounded-[var(--radius-md)] border border-border bg-card">
            {slash.matches.map((task, index) => (
              <button
                key={task.id}
                type="button"
                role="option"
                aria-selected={index === slash.index}
                onMouseDown={(event) => {
                  event.preventDefault();
                  slash.choose(task);
                }}
                className={`block min-h-11 w-full px-3 py-2 text-left text-sm ${
                  index === slash.index ? "bg-secondary text-foreground" : "text-muted-foreground"
                }`}
              >
                <span className="mr-1.5 font-mono text-[11px] text-muted-foreground">/</span>
                <span className="break-words">{task.name}</span>
              </button>
            ))}
          </div>
        ) : null}
        {ask.mention && ask.mentionMatches.length > 0 ? (
          <div className="mb-2 max-h-52 w-full max-w-full overflow-y-auto overscroll-contain rounded-[var(--radius-md)] border border-border bg-card">
            {ask.mentionMatches.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  ask.chooseMention(item);
                }}
                className={`block min-h-11 w-full px-3 py-2 text-left text-sm ${
                  index === ask.mentionIndex
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <SourceMark item={item} className="mr-1.5" />
                <span className="break-words">{item.title}</span> <ArtifactNote item={item} />{" "}
                <TypeBadge item={item} size="sm" />
              </button>
            ))}
          </div>
        ) : null}
        {!mobile ? (
          <div className="mb-2">
            <AskScopeChip ask={ask} workstream={slash.chosen} />
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            ref={ask.composerRef}
            value={ask.draft}
            enterKeyHint="send"
            inputMode="text"
            onChange={(event) => {
              ask.onDraftChange(event.target.value, event.target.selectionStart ?? 0);
              slash.onChange(event.target.value, event.target.selectionStart ?? 0);
            }}
            onKeyDown={(event) => {
              if (slash.open) {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  slash.setIndex((i) => (i + 1) % slash.matches.length);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  slash.setIndex((i) => (i - 1 + slash.matches.length) % slash.matches.length);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  const pick = slash.matches[slash.index];
                  if (pick) slash.choose(pick);
                } else if (event.key === "Escape") {
                  slash.close();
                }
                return;
              }
              if (!ask.mention || ask.mentionMatches.length === 0) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                ask.setMentionIndex((i) => (i + 1) % ask.mentionMatches.length);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                ask.setMentionIndex(
                  (i) => (i - 1 + ask.mentionMatches.length) % ask.mentionMatches.length,
                );
              } else if (event.key === "Enter") {
                event.preventDefault();
                const pick = ask.mentionMatches[ask.mentionIndex];
                if (pick) ask.chooseMention(pick);
              } else if (event.key === "Escape") {
                ask.setMention(null);
              }
            }}
            placeholder="What do you want to think through? Type @ to point at a piece of work. Type / for a workstream."
            rows={mobile ? 2 : 3}
            className="min-h-[64px] resize-none"
          />
          <Button onClick={() => void ask.submit()} disabled={ask.pending || !ask.draft.trim()}>
            {ask.pending ? <NbDots label="Sending" /> : "Send"}
          </Button>
        </div>
      </div>
    </footer>
  );
}

/**
 * The shared Ask Lasso surface: identical machinery, identical tabs, whether
 * it is docked on the right or filling a phone screen.
 */
export function AskSurface({
  ask,
  tab,
  onTab,
  engagementId,
  engagementTitle,
  profileId,
  orgId,
  mobile,
  emptyActions,
  inline,
}: {
  ask: AskLasso;
  tab: AskTab;
  onTab: (tab: AskTab) => void;
  engagementId: string;
  engagementTitle: string;
  profileId: string;
  orgId: string;
  onClose: () => void;
  mobile?: boolean;
  emptyActions?: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <>
      <header className="shrink-0 border-b border-border px-4 pb-2 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className={`flex min-w-0 gap-2 ${inline ? "items-center" : "items-start"}`}>
          <LassoThinkingMark
            kind="signature"
            size={LOOP_SIZE_CHAT}
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            {inline ? (
              <AskTabs
                tab={tab}
                onTab={onTab}
                onNewChat={() => {
                  ask.newSession();
                  onTab("messages");
                }}
              />
            ) : (
              <>
                <p className="micro-label micro-label-ai pr-12">Ask Lasso</p>
                <h2 className="page-title mt-1 break-words text-[17px] leading-snug">
                  {engagementTitle}
                </h2>
                <div className="mt-2">
                  <AskTabs
                    tab={tab}
                    onTab={onTab}
                    onNewChat={() => {
                      ask.newSession();
                      onTab("messages");
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <WorkPicker ask={ask} engagementId={engagementId} />

      {tab === "messages" ? <MessagesTab ask={ask} emptyActions={emptyActions} /> : null}
      {tab === "history" ? <HistoryTab ask={ask} /> : null}

      {ask.error ? <p className="px-4 pb-2 text-sm text-destructive">{ask.error}</p> : null}

      <div className={inline ? "sticky bottom-0 z-10" : undefined}>
        {tab === "messages" ? <AskComposer ask={ask} mobile={mobile ?? false} engagementId={engagementId} orgId={orgId} /> : null}
      </div>

      {!mobile ? (
        <Link
          to="/ai-record"
          search={{ ask: true }}
          className="border-t border-border px-4 py-2 text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
        >
          Open in All conversations →
        </Link>
      ) : null}

      <SaveForOneOnOneDialog
        target={ask.saveTarget}
        onOpenChange={(next) => {
          if (!next) ask.setSaveTarget(null);
        }}
        profileId={profileId}
        orgId={orgId}
      />
    </>
  );
}
