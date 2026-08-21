import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { AnswerSources } from "@/components/reflect/AnswerSources";
import { CoverageNote } from "@/components/reflect/CoverageNote";
import {
  InlineAnalysisBlocks,
  SelectionAnalysisChips,
  type ChipTarget,
} from "@/components/reflect/ChatAnalyses";
import { GraphiteIcon, type GraphiteIconName } from "@/components/notebook/icons";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { ContextAudit, ThinkingTrail } from "@/components/reflect/ContextTrail";
import { SaveForOneOnOneDialog } from "@/components/oneonone/SaveForOneOnOne";
import { Button } from "@/components/ui/button";
import { MappedWorkChecklist } from "@/components/reflect/MappedWorkChecklist";
import { Textarea } from "@/components/ui/textarea";
import { parseManifest } from "@/lib/context-manifest";
import type { AnalysisPreset } from "@/lib/analysis-presets";
import type { WorkItemRow } from "@/lib/work-types";
import { ArtifactNote, SourceMark } from "@/components/work/SourceMark";
import { TypeBadge } from "@/components/work/TypeIcon";
import type { AskTab } from "@/components/reflect/ask-dock-state";
import type { AskLasso } from "@/components/reflect/use-ask-lasso";

/** Three grey dots. The only thinking treatment inside Ask Lasso. */
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
  { id: "analyses", label: "Analyses", icon: "analyses" },
];

/**
 * Three panels and one action. "New chat" sits in the same row because that is
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
        <button
          type="button"
          role="button"
          onClick={onNewChat}
          className="nb-ask-tab"
        >
          <GraphiteIcon name="plus" size={16} />
          <span>New chat</span>
        </button>
      ) : null}
    </div>
  );
}

/** The scope chip: what Lasso will read on the next message. */
export function AskScopeChip({ ask, block }: { ask: AskLasso; block?: boolean }) {
  const label =
    ask.draftPointed.length > 0
      ? `Pointed at: ${ask.draftPointed.length} ${ask.draftPointed.length === 1 ? "item" : "items"}`
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
      <span className="shrink-0 text-muted-foreground">
        {ask.pickerOpen ? "Hide" : "Change"}
      </span>
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
function MessagesTab({ ask }: { ask: AskLasso }) {
  const messages = ask.messages ?? [];
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
          </>
        ) : null}

        {messages.map((message) => (
          <div key={message.id}>
            <p
              className={`nb-binder-label${message.role === "user" ? "" : " nb-speaker-ai"}`}
            >
              {message.role === "user" ? "You" : "AI"}
            </p>
            {message.role === "user" ? (
              <p className="nb-binder-line whitespace-pre-wrap text-sm text-foreground">
                {message.content}
              </p>
            ) : (
              <>
                <MarkdownMessage content={message.content} variant="binder" />
                <div className="nb-binder-inset">
                  <ContextAudit manifest={parseManifest(message.context_manifest)} />
                  <AnswerSources sources={ask.sourcesByMessage?.[Number(message.id)] ?? []} />
                  <button
                    type="button"
                    onClick={() =>
                      ask.setSaveTarget({
                        text: message.content,
                        kind: "chat_excerpt",
                        sessionId: ask.sessionId,
                      })
                    }
                    className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Save for 1:1
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {ask.pending && ask.streamed ? (
          <div>
            <p className="nb-binder-label nb-speaker-ai">AI</p>
            <MarkdownMessage content={ask.streamed} variant="binder" className="nb-stream" />
          </div>
        ) : null}

        {ask.pending ? (
          <div className="nb-binder-line flex items-center gap-2">
            <NbDots />
            <span className="text-sm text-muted-foreground">
              {ask.streamed ? "Writing" : "Reading your work"}
            </span>
          </div>
        ) : null}

        {ask.pending ? (
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
              <span>
                {expanded ? "Show fewer chats" : `Show all ${sessions.length} chats`}
              </span>
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

function AnalysesTab({
  ask,
  engagementId,
  engagementTitle,
  profileId,
  onClose,
}: {
  ask: AskLasso;
  engagementId: string;
  engagementTitle: string;
  profileId: string;
  onClose: () => void;
}) {
  const readsDetail =
    ask.selectedItems.length === 1
      ? "The piece of work you selected, and the brief when one exists."
      : "The pieces of work you selected, and the brief when one exists.";
  const all = ask.selectedItems.length === ask.mapped.length;
  const scopeLine = all
    ? "All work in this engagement"
    : `${ask.selectedItems.length} ${ask.selectedItems.length === 1 ? "piece" : "pieces"} selected`;
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
      {ask.mapped.length > 0 ? (
        <button
          type="button"
          onClick={() => ask.setPickerOpen(!ask.pickerOpen)}
          className="flex w-full items-center gap-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="truncate">{scopeLine}</span>
          <span className="shrink-0 text-accent-deep">· Change</span>
        </button>
      ) : null}
      {ask.mapped.length > 0 ? (
        <SelectionAnalysisChips
          selected={ask.selectedItems}
          engagement={{ id: engagementId, title: engagementTitle }}
          briefCandidates={ask.mapped}
          engagementHasBrief={ask.engagementBrief ?? false}
          firmCheckCount={(ask.firmChecks ?? []).length}
          orgName={ask.profile?.org_name}
          orgId={ask.profile?.org_id}
          profileId={ask.profile?.id}
          onAdjust={() => ask.setPickerOpen(true)}
          canAuthorChecks={ask.profile?.role === "coach" || ask.profile?.role === "admin"}
          onAuthorCheck={onClose}
          readsDetail={readsDetail}
          running={ask.analyses.running}
          onRun={(preset: AnalysisPreset, target: ChipTarget, checkId?: string) =>
            void ask.analyses.runPreset(preset, target, readsDetail, checkId)
          }

        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No work is mapped into this engagement yet, so there is nothing to analyse.
        </p>
      )}
      {ask.analyses.error ? <p className="text-sm text-destructive">{ask.analyses.error}</p> : null}
      <InlineAnalysisBlocks
        results={ask.analyses.results}
        profileId={profileId}
        onSaveForOneOnOne={(input) => ask.setSaveTarget(input)}
      />
      {ask.analyses.running ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <NbDots />
            <span className="text-sm text-muted-foreground">
              Applying {ask.analyses.running.label}
            </span>
          </div>
          {ask.analyses.streamed ? <MarkdownMessage content={ask.analyses.streamed} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** The composer, scope chip and send. Send is the one filled green here. */
export function AskComposer({ ask, mobile }: { ask: AskLasso; mobile?: boolean }) {
  return (
    <footer className="shrink-0 border-t border-border bg-card">
      {mobile ? <AskScopeChip ask={ask} block /> : null}
      <div className="px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
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
            <AskScopeChip ask={ask} />
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            ref={ask.composerRef}
            value={ask.draft}
            enterKeyHint="send"
            inputMode="text"
            onChange={(event) =>
              ask.onDraftChange(event.target.value, event.target.selectionStart ?? 0)
            }
            onKeyDown={(event) => {
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
            placeholder="What do you want to think through? Type @ to point at a piece of work."
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
  onClose,
  mobile,
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
}) {
  return (
    <>
      <header className="shrink-0 border-b border-border px-4 pb-2 pt-[calc(1rem+env(safe-area-inset-top))]">
        <p className="micro-label micro-label-ai pr-12">Ask Lasso</p>
        <h2 className="page-title mt-1 break-words text-[17px] leading-snug">{engagementTitle}</h2>
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
      </header>

      <WorkPicker ask={ask} engagementId={engagementId} />

      {tab === "messages" ? <MessagesTab ask={ask} /> : null}
      {tab === "history" ? <HistoryTab ask={ask} /> : null}
      {tab === "analyses" ? (
        <AnalysesTab
          ask={ask}
          engagementId={engagementId}
          engagementTitle={engagementTitle}
          profileId={profileId}
          onClose={onClose}
        />
      ) : null}

      {ask.error ? <p className="px-4 pb-2 text-sm text-destructive">{ask.error}</p> : null}

      {tab === "messages" ? <AskComposer ask={ask} mobile={mobile ?? false} /> : null}

      {!mobile ? (
        <Link
          to="/reflect"
          className="border-t border-border px-4 py-2 text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
        >
          Open in Reflect →
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
