import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { DrawnCheck, DrawnEllipse, DrawnStrike, useMark } from "@/components/notebook/marks";
import {
  GraphiteIcon,
  getIconSignature,
  type GraphiteIconName,
} from "@/components/notebook/icons";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/design/icons")({
  head: () => ({
    meta: [
      { title: "Icons · Lasso design system" },
      { name: "description", content: "Internal reference for the notebook icon set." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Icons · Lasso design system" },
      { property: "og:description", content: "Internal reference for the notebook icon set." },
    ],
  }),
  component: IconsGallery,
});

type Entry = {
  name: GraphiteIconName;
  label: string;
  use: string;
  wit: string;
  motion: string;
  usedIn: string;
  v2?: boolean;
};

const FAMILIES: { family: string; entries: Entry[] }[] = [
  {
    family: "Navigation",
    entries: [
      {
        name: "connectors",
        label: "Connectors",
        use: "Where work comes from, one row per source.",
        wit: "The cord leaves with a kink, as if it was just unplugged.",
        motion: "Seat: the body pushes down one pixel and settles.",
        usedIn: "Sidebar, connectors page, empty states",
      },
      {
        name: "work",
        label: "Work",
        use: "Everything captured, mapped or not.",
        wit: "The top sheet is curled at one corner.",
        motion: "Lift: the top sheet rises and tips two degrees.",
        usedIn: "Sidebar, work header",
      },
      {
        name: "engagement",
        label: "Engagement",
        use: "A single client engagement.",
        wit: "The flap stands slightly open, never fully shut.",
        motion: "Flap: the front opens six degrees and closes.",
        usedIn: "Sidebar engagement rows, canvas breadcrumbs",
      },
      {
        name: "overview",
        label: "Overview",
        use: "The week at a glance.",
        wit: "The sun is only half over the horizon.",
        motion: "Rise: the sun lifts two pixels into full opacity.",
        usedIn: "Sidebar, overview rows",
      },
      {
        name: "reflect",
        label: "Reflect",
        use: "Your own read on the work.",
        wit: "The loop does not close, and a small tick returns.",
        motion: "Tilt: the loop leans five degrees and rights itself.",
        usedIn: "Sidebar, reflect prompts",
      },
      {
        name: "ai-record",
        label: "Chat library",
        use: "What the assistant did, in plain terms.",
        wit: "The second line of text is short, like a trailing thought.",
        motion: "Pop: one soft scale of the sheet.",
        usedIn: "Sidebar, Chat library header",
      },
      {
        name: "one-on-one",
        label: "1:1 prep",
        use: "Preparing a conversation with your coach.",
        wit: "Two chat bubbles, the rear one smaller and set back.",
        motion: "Pop: the front bubble gives one soft swell.",
        usedIn: "Sidebar, coaching page",
        v2: true,
      },
      {
        name: "decisions",
        label: "Decisions",
        use: "Calls you made and stood behind.",
        wit: "The unchosen branch stops short and leaves a gap.",
        motion: "The chosen branch draws its extension and arrow.",
        usedIn: "Sidebar, decision log rows",
        v2: true,
      },
      {
        name: "firm",
        label: "Firm view",
        use: "The firm level read across engagements.",
        wit: "Flat roof, one door, exactly two windows, nothing else.",
        motion: "Nudge: a single pixel rise.",
        usedIn: "Sidebar, firm page",
        v2: true,
      },
      {
        name: "members",
        label: "Members",
        use: "People in your firm.",
        wit: "The smaller figure leans toward the larger one.",
        motion: "Lean in: the second figure steps a pixel closer.",
        usedIn: "Sidebar, coaching roster",
      },
      {
        name: "settings",
        label: "Settings",
        use: "Preferences and privacy.",
        wit: "The lower knob sits off centre, as if just adjusted.",
        motion: "Slide: the off centre knob travels and returns.",
        usedIn: "Sidebar, private chips, row actions",
      },
    ],
  },
  {
    family: "Dock and chat",
    entries: [
      {
        name: "ask-lasso",
        label: "Ask Lasso",
        use: "Opens the assistant dock.",
        wit: "An open loop with a lively tail, deliberately not a knot.",
        motion: "Flick: the tail kicks.",
        usedIn: "Page headers, mobile Ask tab",
      },
      {
        name: "messages",
        label: "Messages",
        use: "The live conversation tab.",
        wit: "The tail kicks left, off the corner.",
        motion: "Pop: one soft scale.",
        usedIn: "Dock tabs",
      },
      {
        name: "history",
        label: "History",
        use: "Past conversations.",
        wit: "The rim opens at the top left, where the arrow points back.",
        motion: "Sweep: the hands swing back and settle.",
        usedIn: "Dock tabs, history rows",
        v2: true,
      },
      {
        name: "analyses",
        label: "Analyses",
        use: "Preset reads over your record.",
        wit: "Three unequal lines run out past the lens on the right.",
        motion: "Lens: the glass slides along the lines and back.",
        usedIn: "Dock tabs, analysis cards",
        v2: true,
      },
      {
        name: "send",
        label: "Send",
        use: "Sends the message.",
        wit: "A short motion tail behind the plane.",
        motion: "Fly: the plane nudges forward and returns.",
        usedIn: "Composer",
      },
      {
        name: "attach",
        label: "Attach",
        use: "Attach an item from the record.",
        wit: "The clip mouth stays slightly open.",
        motion: "Pinch: one horizontal squeeze.",
        usedIn: "Composer",
      },
    ],
  },
  {
    family: "Actions",
    entries: [
      {
        name: "plus",
        label: "Plus",
        use: "Add a source, workstream or engagement.",
        wit: "The arms are a hair unequal, drawn quickly.",
        motion: "Turn: a quarter rotation.",
        usedIn: "Primary buttons, ghost column",
      },
      {
        name: "check",
        label: "Check",
        use: "Confirming a suggestion or a step.",
        wit: "The second stroke runs long and confident.",
        motion: "Overshoot: draws in and settles back.",
        usedIn: "Confirm actions, workstream steps",
      },
      {
        name: "close",
        label: "Close",
        use: "Dismisses a panel or slide-over.",
        wit: "Two separate pen flicks that cross, not one X.",
        motion: "Flick twice: the strokes draw in sequence.",
        usedIn: "Dock header, slide-over, mobile nav",
      },
      {
        name: "external-link",
        label: "Open file",
        use: "Opens the source in its own tool.",
        wit: "The whole top right quadrant is gone, so the arrow has room.",
        motion: "Leap: the arrow jumps out and back.",
        usedIn: "Row actions, slide-over",
        v2: true,
      },
    ],
  },
  {
    family: "Utility",
    entries: [
      {
        name: "search",
        label: "Search",
        use: "Finding a capture or a decision.",
        wit: "The handle overshoots the glass slightly.",
        motion: "Scan: one small arc.",
        usedIn: "Filters, connectors",
      },
      {
        name: "chevron-right",
        label: "Chevron",
        use: "Moves you into a record.",
        wit: "The lower arm is a touch shorter than the upper.",
        motion: "Forward: a pixel and a half of travel.",
        usedIn: "List rows, suggested actions",
      },
      {
        name: "drag-handle",
        label: "Drag handle",
        use: "Picks a card up on the canvas.",
        wit: "The dots are not on a perfect grid.",
        motion: "Wave: the three rows rise in sequence.",
        usedIn: "Canvas cards, mobile reorder handle",
      },
    ],
  },
];

const SIZES = [16, 20, 32, 48] as const;
const BACKGROUNDS = [
  { key: "white", label: "White", value: "var(--nb-white)", ink: "var(--nb-ink)" },
  { key: "grey", label: "Grey", value: "var(--nb-grey-1)", ink: "var(--nb-ink)" },
  { key: "ink", label: "Ink", value: "var(--nb-ink)", ink: "var(--nb-white)" },
] as const;

function IconsGallery() {
  const [size, setSize] = useState<number>(20);
  const [bg, setBg] = useState<(typeof BACKGROUNDS)[number]["key"]>("white");
  const [replay, setReplay] = useState<Record<string, number>>({});
  const [allNonce, setAllNonce] = useState(0);
  const background = BACKGROUNDS.find((option) => option.key === bg)!;

  function replayOne(name: string) {
    setReplay((current) => ({ ...current, [name]: (current[name] ?? 0) + 1 }));
  }

  return (
    <div className="pb-16">
      <header className="mb-6">
        <h1 className="page-title">Icons</h1>
        <p className="mt-1.5 micro-label">Internal reference · notebook icon set</p>
      </header>

      <div className="sticky top-0 z-10 mb-6 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 py-3 backdrop-blur">
        <span className="micro-label">Size</span>
        {SIZES.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={size === option}
            className={size === option ? "border-foreground" : ""}
            onClick={() => setSize(option)}
          >
            {option}
          </Button>
        ))}
        <span className="micro-label ml-3">Background</span>
        {BACKGROUNDS.map((option) => (
          <Button
            key={option.key}
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={bg === option.key}
            className={bg === option.key ? "border-foreground" : ""}
            onClick={() => setBg(option.key)}
          >
            {option.label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          className="ml-auto"
          onClick={() => {
            setAllNonce((n) => n + 1);
            setReplay({});
          }}
        >
          Replay all
        </Button>
      </div>

      <div className="space-y-10">
        {FAMILIES.map((family) => (
          <section key={family.family}>
            <h2 className="micro-label">{family.family}</h2>
            <div className="mt-3 space-y-3">
              {family.entries.map((entry) => {
                const nonce = `${allNonce}-${replay[entry.name] ?? 0}`;
                return (
                  <article
                    key={entry.name}
                    className="rounded-[var(--radius)] border border-border bg-card px-5 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <span
                          className="flex size-20 items-center justify-center rounded-[var(--radius-md)] border border-border"
                          style={{ background: background.value, color: background.ink }}
                        >
                          <GraphiteIcon name={entry.name} size={48} animate={false} />
                        </span>
                        <span
                          className="flex size-12 items-center justify-center rounded-[var(--radius-md)] border border-border"
                          style={{ background: background.value, color: background.ink }}
                        >
                          <GraphiteIcon
                            key={nonce}
                            name={entry.name}
                            size={size}
                            playOnMount
                          />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {entry.label}
                            {entry.v2 ? (
                              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                                v2
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground">{entry.use}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => replayOne(entry.name)}
                      >
                        Replay
                      </Button>
                    </div>

                    <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-[8rem_1fr]">
                      <dt className="micro-label">Detail</dt>
                      <dd className="text-foreground">{entry.wit}</dd>
                      <dt className="micro-label">Motion</dt>
                      <dd className="text-foreground">{entry.motion}</dd>
                      <dt className="micro-label">Used in</dt>
                      <dd className="text-foreground">{entry.usedIn}</dd>
                      <dt className="micro-label">Keyframe</dt>
                      <dd className="font-mono text-[11px] text-muted-foreground">
                        {getIconSignature(entry.name)}
                      </dd>
                    </dl>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-10 rounded-[var(--radius)] border border-border bg-card px-5 py-4">
        <h2 className="micro-label">Rules</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-foreground">
          <li>20×20 grid, 1.75px stroke, round caps.</li>
          <li>One witty detail, one signature move.</li>
          <li>Mount draw-in 1440ms, once per session.</li>
          <li>
            On hover, focus or tap the glyph redraws (700ms), then the signature fires (600ms). This
            is the authored exception to the under-500ms product rule: decorative and
            intent-triggered only.
          </li>
          <li>No icon loops and no icon animates idle.</li>
          <li>Reduced motion: static and fully drawn.</li>
        </ul>
      </section>

      <section className="mt-6 rounded-[var(--radius)] border border-border bg-card px-5 py-4">
        <h2 className="micro-label">Motion exceptions · app-wide</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The product rule is that motion finishes inside 500ms. These are the durations that
          deliberately exceed it and the reason each one earns it. Anything over 500ms that is not
          on this list is drift, not a decision.
        </p>

        <h3 className="mt-4 micro-label">Draws · fire once</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-foreground">
          <li>
            <span className="font-mono text-[11px] text-muted-foreground">550ms</span> ·{" "}
            <span className="font-mono text-[11px] text-muted-foreground">dur/settle</span> · the
            longest duration the scale itself sanctions.
          </li>
          <li>
            <span className="font-mono text-[11px] text-muted-foreground">600ms</span> · icon
            signature move, once the redraw has landed.
          </li>
          <li>
            <span className="font-mono text-[11px] text-muted-foreground">700ms</span> · icon
            redraw on hover, focus or tap. Decorative and intent-triggered.
          </li>
          <li>
            <span className="font-mono text-[11px] text-muted-foreground">730ms</span> · firework
            life on a journey node. A one-off celebration at the end of a walk, not an entrance.
          </li>
          <li>
            <span className="font-mono text-[11px] text-muted-foreground">800ms</span> ·{" "}
            <span className="font-mono text-[11px] text-muted-foreground">dur/draw</span> · a title
            rule drawing itself.
          </li>
          <li>
            <span className="font-mono text-[11px] text-muted-foreground">1100ms</span> · the
            landing front-door rule. The first motion a visitor ever sees, paced as a slow reveal
            on purpose. Snapping it to 800ms would make the first impression 27% faster.
          </li>
          <li>
            <span className="font-mono text-[11px] text-muted-foreground">1440ms</span> · icon mount
            draw-in, once per session.
          </li>
        </ul>

        <h3 className="mt-4 micro-label">Ambient loops · never stop</h3>
        <p className="mt-1.5 text-xs text-muted-foreground">
          A loop period is a property of the texture, not of the entrance scale. These are excluded
          from the duration tokens by design.
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-foreground">
          <li>
            <span className="font-mono text-[11px] text-muted-foreground">900ms</span> · dash march,
            on a resolving lasso and on marching ink.
          </li>
          <li>
            <span className="font-mono text-[11px] text-muted-foreground">1200ms</span> · thinking
            dots.
          </li>
          <li>
            <span className="font-mono text-[11px] text-muted-foreground">1600ms</span> · reading
            eyes scanning.
          </li>
          <li>
            <span className="font-mono text-[11px] text-muted-foreground">7s</span> · hatch
            breathe, with a counterphase pair offset half a cycle.
          </li>
          <li>
            <span className="font-mono text-[11px] text-muted-foreground">8s</span> · spider wobble.
          </li>
          <li>
            <span className="font-mono text-[11px] text-muted-foreground">12s</span> · gap drift on
            the invisible-work strip.
          </li>
        </ul>
      </section>

      <MarksSection />
    </div>
  );
}

function MarksSection() {
  const check = useMark();
  const ellipse = useMark();
  const strike = useMark();

  return (
    <section className="mt-6 rounded-[var(--radius)] border border-border bg-card px-5 py-4">
      <h2 className="micro-label">Marks</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Three hand-drawn strokes, and nothing else in the product is hand-drawn. At most one mark
        draws per viewport: a second mark inside 400ms renders nothing at all.
      </p>

      <div className="mt-4 space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-4">
          <Button type="button" size="sm" variant="outline" onClick={() => check.fire()}>
            Draw the check
          </Button>
          <span className="flex items-center gap-2">
            {check.shown ? <DrawnCheck key={check.markKey} /> : null}
            <span className="text-muted-foreground">
              Check: a decision confirmed, a suggestion accepted.
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="button" size="sm" variant="outline" onClick={() => ellipse.fire()}>
            Draw the ellipse
          </Button>
          <span className="flex items-center gap-2">
            <span className="relative px-2 py-1 text-foreground">
              Shared
              {ellipse.shown ? <DrawnEllipse key={ellipse.markKey} /> : null}
            </span>
            <span className="text-muted-foreground">Ellipse: a share confirmed.</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="button" size="sm" variant="outline" onClick={() => strike.fire()}>
            Draw the strike
          </Button>
          <span className="flex items-center gap-2">
            <span className="relative px-1 text-foreground">
              Discarded
              {strike.shown ? <DrawnStrike key={strike.markKey} /> : null}
            </span>
            <span className="text-muted-foreground">Strike: discarded, dismissed, removed.</span>
          </span>
        </div>
      </div>
    </section>
  );
}
