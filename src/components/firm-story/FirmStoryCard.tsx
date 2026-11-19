import { Button } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/chip";
import { tagVariants } from "@/components/ui/tag";
import type { StoryRolePick } from "@/lib/firm-story-script";
import { FIRM_STORY_COPY, STORY_LAST_BEAT, STORY_REACTIONS, type StoryMode, type StoryReaction, type StoryView } from "@/lib/firm-story-shared";

/** The words a card shows, already filled with the product's name by the caller. */
export type StoryWords = {
  demoLine: string;
  closing: string;
  rolePrompt: string;
  roleChoices: readonly { id: StoryRolePick; label: string }[];
  /** The beat's own words, for a beat view; the other window's "You are" for a handoff. */
  title: string;
  caption: string;
  notes: string;
  question: string;
  ask: string | null;
};

export type FirmStoryCardProps = {
  view: StoryView;
  words: StoryWords;
  mode: StoryMode;
  /** The label of the "take me there" control, or null when the person is already where the beat happens. */
  goLabel: string | null;
  reaction: StoryReaction | null;
  rolePick: StoryRolePick | null;
  /** On a handoff card: whether this window has an earlier beat to go back to. */
  canGoBack: boolean;
  onMode: (mode: StoryMode) => void;
  onGo: () => void;
  onNext: () => void;
  onBack: () => void;
  onExplore: () => void;
  onResumeHere: () => void;
  onReact: (reaction: StoryReaction) => void;
  onRolePick: (pick: StoryRolePick) => void;
  /** Ends the story in this tab: the beat is forgotten and the start button returns. */
  onEnd: () => void;
};

const shell =
  "pointer-events-auto flex max-h-[60dvh] md:max-h-[70dvh] w-full flex-col gap-3 overflow-y-auto rounded-[var(--radius)] border border-border bg-card p-4 text-foreground shadow-card";
const eyebrow = "font-mono text-(length:--type-label) uppercase tracking-[0.08em] text-muted-foreground";

function DemoLine({ text }: { text: string }) {
  return (
    <p data-story-demo-line className="border-t border-border pt-2 text-(length:--type-small) text-muted-foreground">
      {text}
    </p>
  );
}

/** The two ways off a card: look around and come back, or end the story in this tab. */
function Leave({ onExplore, onEnd }: { onExplore: () => void; onEnd: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={onExplore}>
        {FIRM_STORY_COPY.explore}
      </Button>
      <Button type="button" variant="ghost" size="sm" data-story-end onClick={onEnd}>
        {FIRM_STORY_COPY.end}
      </Button>
    </div>
  );
}

/**
 * One card of the Kestrel Bay demo story: a beat, a handoff to the other window, or the closing line. Presentational:
 * every word and every decision comes in as a prop, so it renders the same in a test as over the live board.
 * Built from the shared primitives and job colours only, so it follows whichever brand is on.
 */
export function FirmStoryCard(props: FirmStoryCardProps) {
  const { view, words, mode } = props;

  if (view.kind === "idle") return null;

  if (view.kind === "done") {
    return (
      <section aria-label={FIRM_STORY_COPY.label} data-testid="firm-story-card" data-story-view="done" className={shell}>
        <p data-story-closing className="text-(length:--type-title) font-medium text-foreground">
          {words.closing}
        </p>
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={props.onEnd}>
            {FIRM_STORY_COPY.close}
          </Button>
        </div>
        <DemoLine text={words.demoLine} />
      </section>
    );
  }

  if (view.kind === "handoff") {
    return (
      <section aria-label={FIRM_STORY_COPY.label} data-testid="firm-story-card" data-story-view="handoff" data-story-beat={view.to.n} className={shell}>
        <h2 className="text-(length:--type-title) font-medium text-foreground">{FIRM_STORY_COPY.handoffTitle(words.title)}</h2>
        <p className="text-(length:--type-body) text-foreground">
          {view.resumeAt === null ? FIRM_STORY_COPY.otherWindowDone : FIRM_STORY_COPY.handoffBody(words.title)}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Leave onExplore={props.onExplore} onEnd={props.onEnd} />
          <div className="flex flex-wrap items-center gap-2">
            {props.canGoBack ? (
              <Button type="button" variant="outline" size="sm" onClick={props.onBack}>
                {FIRM_STORY_COPY.back}
              </Button>
            ) : null}
            {view.resumeAt !== null ? (
              <Button type="button" variant="ink" size="sm" onClick={props.onResumeHere}>
                {FIRM_STORY_COPY.handoffBack}
              </Button>
            ) : null}
          </div>
        </div>
        <DemoLine text={words.demoLine} />
      </section>
    );
  }

  const { beat, isFirst, isLast } = view;
  const presenter = mode === "presenter";
  return (
    <section aria-label={FIRM_STORY_COPY.label} data-testid="firm-story-card" data-story-view="beat" data-story-beat={beat.n} data-story-mode={mode} className={shell}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span data-story-you-are className={tagVariants({ tone: "accent" })}>{`${FIRM_STORY_COPY.youAre}: ${beat.youAre}`}</span>
          {beat.n > 0 ? <span className={eyebrow}>{FIRM_STORY_COPY.beatOf(beat.n, STORY_LAST_BEAT)}</span> : null}
        </div>
        <button
          type="button"
          data-story-mode-toggle
          aria-pressed={presenter}
          className={chipVariants({ tone: presenter ? "accent" : "quiet" })}
          onClick={() => props.onMode(presenter ? "self" : "presenter")}
        >
          {FIRM_STORY_COPY.presenterNotes}
        </button>
      </div>

      <h2 className="text-(length:--type-title) font-medium text-foreground">{words.title}</h2>
      <p data-story-caption className="text-(length:--type-body) text-foreground">
        {words.caption}
      </p>

      {presenter ? (
        <div data-story-notes className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-secondary p-3">
          <p className={eyebrow}>{FIRM_STORY_COPY.say}</p>
          <p className="text-(length:--type-small) text-foreground">{words.notes}</p>
          <p className={eyebrow}>{FIRM_STORY_COPY.askViewer}</p>
          <p data-story-question className="text-(length:--type-body) font-medium text-foreground">
            {words.question}
          </p>
        </div>
      ) : null}

      {words.ask ? (
        <p data-story-ask className="text-(length:--type-small) text-muted-foreground">
          <span className={eyebrow}>{`${FIRM_STORY_COPY.askThis}: `}</span>
          <span className="text-foreground">{words.ask}</span>
        </p>
      ) : null}

      {beat.n === 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className={eyebrow}>{words.rolePrompt}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {words.roleChoices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                data-story-role={choice.id}
                aria-pressed={props.rolePick === choice.id}
                className={chipVariants({ tone: props.rolePick === choice.id ? "accent" : "quiet" })}
                onClick={() => props.onRolePick(choice.id)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className={eyebrow}>{FIRM_STORY_COPY.reactionsLabel}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {STORY_REACTIONS.map((reaction) => (
              <button
                key={reaction}
                type="button"
                data-story-reaction={reaction}
                aria-pressed={props.reaction === reaction}
                className={chipVariants({ tone: props.reaction === reaction ? "accent" : "quiet" })}
                onClick={() => props.onReact(reaction)}
              >
                {FIRM_STORY_COPY.reactions[reaction]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Leave onExplore={props.onExplore} onEnd={props.onEnd} />
        <div className="flex flex-wrap items-center gap-2">
          {props.goLabel ? (
            <Button type="button" variant="outline" size="sm" data-story-go onClick={props.onGo}>
              {props.goLabel}
            </Button>
          ) : null}
          {!isFirst ? (
            <Button type="button" variant="outline" size="sm" onClick={props.onBack}>
              {FIRM_STORY_COPY.back}
            </Button>
          ) : null}
          <Button type="button" variant="ink" size="sm" data-story-next onClick={props.onNext}>
            {isLast ? FIRM_STORY_COPY.finish : FIRM_STORY_COPY.next}
          </Button>
        </div>
      </div>
      <DemoLine text={words.demoLine} />
    </section>
  );
}
