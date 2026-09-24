import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

import audienceImage from "@/assets/landing-audience.jpg";
import { VendorMark, type VendorKey } from "@/components/marketing/VendorMark";
import { BrandLogo } from "@/components/connectors/BrandLogo";

export function ScaledStage({
  width,
  height,
  children,
  className = "",
  label,
}: {
  width: number;
  height: number;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / width);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ height: height * scale }} role={label ? "img" : undefined} aria-label={label}>
      <div className={`landing-beats-stage absolute left-0 top-0 ${className}`} style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

export type VendorGlyph = "claude" | "chatgpt" | "gemini" | "granola" | "lovable";

type SourceCard = {
  vendor: VendorGlyph;
  label: string;
  title: string;
  excerpt: string;
};

/** Stack order, top to bottom. Tilt and offset come from CSS per index. */
const SOURCES: SourceCard[] = [
  { vendor: "claude", label: "Claude · 14 Aug", title: "Audience strategy", excerpt: "The rule-change moments created the strongest response." },
  { vendor: "chatgpt", label: "ChatGPT · 21 Aug", title: "Channel model", excerpt: "Short-form clips carried attention beyond event day." },
  { vendor: "gemini", label: "Gemini · 9 Sep", title: "Commercial scenario", excerpt: "An 18% bundle uplift held in the illustrative model." },
  { vendor: "granola", label: "Granola · 3 Sep", title: "Client call transcript", excerpt: "The client asked which audience to prioritise first." },
  { vendor: "lovable", label: "Lovable · 12 Sep", title: "Prototype build", excerpt: "A clickable bundle page made the offer concrete." },
];

function SourceGlyph({ vendor, size }: { vendor: VendorGlyph; size: number }) {
  if (vendor === "granola") return <BrandLogo brand="granola" size={size} />;
  return <VendorMark vendor={vendor} size={size} />;
}

export type StoryStep = {
  speaker: "Client question" | "Manager question";
  question: string;
  litSources: VendorGlyph[];
  slide: 0 | 1 | 2 | 3;
  highlight: string;
  answer: string;
  sourceCount: number;
};

/** Illustrative client for the whole story: Bridge4 Partners, advising a regional sports league. */
export const STORY: StoryStep[] = [
  {
    speaker: "Client question",
    question: "Which conversations shaped the recommendation?",
    litSources: ["claude", "granola", "chatgpt"],
    slide: 3,
    highlight: "Weekly fan vote",
    answer: "Three conversations, in order: the client call set the priority, the audience thread found the moment, the channel thread chose the carrier.",
    sourceCount: 3,
  },
  {
    speaker: "Manager question",
    question: "Find the Claude conversation where I said 'rule-change moments'.",
    litSources: ["claude"],
    slide: 0,
    highlight: "rule-change moments",
    answer: "Here it is: Claude, 14 Aug, turn 12. The phrase reached slide 1 unchanged.",
    sourceCount: 1,
  },
  {
    speaker: "Client question",
    question: "Where did the 18% on slide 3 come from?",
    litSources: ["gemini", "lovable"],
    slide: 2,
    highlight: "18%",
    answer: "An illustrative scenario in Gemini on 9 Sep; the bundle page prototype made the assumption concrete. It is a model, not a result.",
    sourceCount: 2,
  },
  {
    speaker: "Manager question",
    question: "What did we consider and reject?",
    litSources: ["chatgpt", "claude"],
    slide: 3,
    highlight: "Paid acquisition",
    answer: "Paid acquisition was costed in the channel thread and set aside on cost to serve; the fan vote was kept. Both decisions are on the record.",
    sourceCount: 2,
  },
];

const SLIDE_TITLES = [
  "Attention lives in the moments between events.",
  "One moment, three carriers.",
  "Bundle the experience, not just the seat.",
  "Build participation into the event.",
] as const;

/** Wraps the step's phrase in the lime highlighter when it appears in this text. */
function Hl({ text, phrase }: { text: string; phrase: string | null }) {
  if (!phrase) return <>{text}</>;
  const at = text.indexOf(phrase);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="landing-story-hl">{phrase}</mark>
      {text.slice(at + phrase.length)}
    </>
  );
}

function MiniBars() {
  return (
    <div className="landing-story-bars" aria-hidden="true">
      <i data-value="short" /><i data-value="events" /><i data-value="email" />
    </div>
  );
}

function ImagePlaceholder() {
  return <div className="landing-story-img-placeholder" aria-hidden="true"><span>Image</span></div>;
}

function DeckSlide({ index, highlight }: { index: number; highlight: string | null }) {
  const footer = <p className="landing-story-slide-footer">Bridge4 Partners · illustrative · {index + 1} / 4</p>;
  if (index === 0) {
    return (
      <div className="landing-story-slide landing-story-slide-split">
        <div className="landing-story-slide-main">
          <p className="landing-story-kicker">01 · Audience signal</p>
          <h3>{SLIDE_TITLES[0]}</h3>
          <p className="landing-story-slide-line">Short clips around <Hl text="rule-change moments" phrase={highlight} /> carried the strongest response in this illustrative case.</p>
          <MiniBars />
        </div>
        <img src={audienceImage} alt="Illustrative audience at an outdoor event" width={1280} height={800} />
        {footer}
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="landing-story-slide">
        <div className="landing-story-slide-main">
          <p className="landing-story-kicker">02 · Channel evidence</p>
          <h3>{SLIDE_TITLES[1]}</h3>
          <p className="landing-story-slide-line">Short-form, community and email, compared on the same moment.</p>
          <div className="landing-story-channel-grid">
            <div><strong>2.4×</strong><span>Short-form</span></div>
            <div><strong>1.6×</strong><span>Community</span></div>
            <div><strong>1.0×</strong><span>Email</span></div>
          </div>
          <p className="landing-story-footnote">Illustrative comparison, not customer results</p>
        </div>
        {footer}
      </div>
    );
  }
  if (index === 2) {
    return (
      <div className="landing-story-slide landing-story-slide-split">
        <div className="landing-story-slide-main">
          <p className="landing-story-kicker">03 · Commercial case</p>
          <h3>{SLIDE_TITLES[2]}</h3>
          <p className="landing-story-slide-line">Pair the seat with a moment people come back for.</p>
          <div className="landing-story-metric"><strong><Hl text="18%" phrase={highlight} /></strong><span>illustrative bundle uplift</span></div>
          <p className="landing-story-footnote">Source: scenario model and pricing conversations</p>
        </div>
        <ImagePlaceholder />
        {footer}
      </div>
    );
  }
  return (
    <div className="landing-story-slide">
      <div className="landing-story-slide-main">
        <p className="landing-story-kicker">04 · Recommendation</p>
        <h3>{SLIDE_TITLES[3]}</h3>
        <p className="landing-story-slide-line">Choose one carrier the fans own; set the costly one aside.</p>
        <div className="landing-story-choice-row"><span>Choose</span><strong><Hl text="Weekly fan vote" phrase={highlight} /></strong></div>
        <div className="landing-story-choice-row" data-choice="rejected"><span>Set aside</span><strong><Hl text="Paid acquisition" phrase={highlight} /></strong></div>
      </div>
      {footer}
    </div>
  );
}

function SourceCardView({ card, lit, cardRef }: { card: SourceCard; lit: boolean; cardRef?: (el: HTMLElement | null) => void }) {
  return (
    <article ref={cardRef} className="landing-story-source" data-lit={lit} data-vendor={card.vendor}>
      <header><SourceGlyph vendor={card.vendor} size={20} /><span>{card.label}</span></header>
      <h3>{card.title}</h3>
      <p>{card.excerpt}</p>
    </article>
  );
}

type FlowPaths = { streams: { vendor: VendorGlyph; d: string }[]; chip: string; w: number; h: number } | null;

/** One stream per lit card, converging on the open slide; one merged chip on to the answer. */
function ConversationTunnel({ paths, step }: { paths: FlowPaths; step: StoryStep }) {
  if (!paths) return null;
  const fragments: Record<VendorGlyph, string> = {
    claude: "Rule-change moments…",
    chatgpt: "Short-form clips…",
    gemini: "18% bundle uplift…",
    granola: "Which audience first…",
    lovable: "Clickable bundle page…",
  };
  return (
    <div className="landing-story-flow" aria-hidden="true">
      <svg width={paths.w} height={paths.h} viewBox={`0 0 ${paths.w} ${paths.h}`}>
        {paths.streams.map((stream) => <path key={stream.vendor} className="landing-story-stream" d={stream.d} pathLength={1} />)}
        <path className="landing-story-stream landing-story-stream-merged" d={paths.chip} pathLength={1} />
      </svg>
      {paths.streams.map((stream) => (
        <div className="landing-story-fragment" key={stream.vendor} style={{ offsetPath: `path("${stream.d}")` }}>
          <SourceGlyph vendor={stream.vendor} size={14} />
          <span>{fragments[stream.vendor]}</span>
        </div>
      ))}
      <div className="landing-story-reach-chip" style={{ offsetPath: `path("${paths.chip}")` }}>
        {step.sourceCount} source{step.sourceCount === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function CircleDoodle({ className }: { className: string }) {
  return (
    <svg className={`landing-story-doodle ${className}`} viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
      <path pathLength={1} vectorEffect="non-scaling-stroke" d="M214 10C330 8 394 58 392 146c-2 92-56 146-196 148C62 296 8 236 10 150 12 66 74 14 208 14c44 1 80 8 112 24" />
    </svg>
  );
}

export function ClosedAuditLine({ count }: { count: number }) {
  return <div className="landing-story-evidence-line"><span>Open the exact source</span><small>{count} source{count === 1 ? "" : "s"}</small></div>;
}

export function StepRow({ label, className = "" }: { g?: "doc" | "chat" | "lens" | "link"; label: string; className?: string }) {
  return <div className={`landing-story-step ${className}`}><span aria-hidden="true" /><span>{label}</span></div>;
}

export type PreviewCardData = {
  vendor: VendorGlyph;
  label?: string;
  tool?: string;
  when?: string;
  title: string;
  excerpt?: string;
  summary?: string;
  url?: string;
  left?: number;
  top?: number;
};
export function PreviewCard({ card }: { card: PreviewCardData; style?: React.CSSProperties }) {
  return <SourceCardView card={{ vendor: card.vendor, label: card.label ?? `${card.tool ?? ""} ${card.when ?? ""}`, title: card.title, excerpt: card.excerpt ?? card.summary ?? "" }} lit />;
}

const LEAVE_MS = 700;

export function HeroMotion({ step = 0, onStepChange }: { step?: number; onStepChange?: (index: number) => void }) {
  const [shown, setShown] = useState(step);
  const [prevSlide, setPrevSlide] = useState<number>(STORY[step]?.slide ?? 3);
  const [leaving, setLeaving] = useState(false);
  const [paths, setPaths] = useState<FlowPaths>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const slideRef = useRef<HTMLDivElement | null>(null);
  const responseRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const sourcesRef = useRef<HTMLDivElement | null>(null);

  const current = STORY[shown] ?? STORY[0]!;

  useEffect(() => {
    if (step === shown) return;
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setLeaving(true);
    const timer = setTimeout(() => {
      setPrevSlide((STORY[shown] ?? STORY[0]!).slide);
      setShown(step);
      setLeaving(false);
    }, reduced ? 0 : LEAVE_MS);
    return () => clearTimeout(timer);
  }, [step, shown]);

  // The path is measured once per step and never reshaped during the hold.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measure = () => {
      const c = canvas.getBoundingClientRect();
      const slide = slideRef.current?.getBoundingClientRect();
      const response = responseRef.current?.getBoundingClientRect();
      if (!slide || !response || slide.width === 0) return setPaths(null);
      const mx = slide.left - c.left;
      const my = slide.top - c.top + slide.height / 2;
      const streams = current.litSources.map((vendor) => {
        const card = cardRefs.current[vendor]?.getBoundingClientRect();
        const sx = card ? card.right - c.left : 0;
        const sy = card ? card.top - c.top + card.height / 2 : my;
        const dx = Math.max(24, (mx - sx) / 2);
        return { vendor, d: `M${sx.toFixed(1)} ${sy.toFixed(1)} C${(sx + dx).toFixed(1)} ${sy.toFixed(1)} ${(mx - dx).toFixed(1)} ${my.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}` };
      });
      const ax = slide.right - c.left;
      const bx = response.left - c.left;
      const by = response.top - c.top + Math.min(40, response.height / 2);
      const chip = `M${ax.toFixed(1)} ${my.toFixed(1)} C${((ax + bx) / 2).toFixed(1)} ${my.toFixed(1)} ${((ax + bx) / 2).toFixed(1)} ${by.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
      setPaths({ streams, chip, w: c.width, h: c.height });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [shown]);

  // On a phone the filmstrip and source row scroll sideways; bring the active item into view.
  useEffect(() => {
    for (const [row, selector] of [[stripRef.current, "[data-active='true']"], [sourcesRef.current, "[data-lit='true']"]] as const) {
      if (!row || row.scrollWidth <= row.clientWidth + 1) continue;
      const item = row.querySelector<HTMLElement>(selector);
      if (item) row.scrollTo({ left: item.offsetLeft - (row.clientWidth - item.offsetWidth) / 2, behavior: "smooth" });
    }
  }, [shown]);

  const words = current.answer.split(" ");
  const sourceLineDelay = 3000 + words.length * 70 + 120;

  return (
    <div className="landing-story-shell" aria-label="AI conversations becoming a client deck, with the source behind each answer">
      <div ref={canvasRef} className="landing-story-canvas" data-leaving={leaving} key={shown}>
        <ConversationTunnel paths={paths} step={current} />

        <section ref={sourcesRef} className="landing-story-sources" aria-label="Source conversations">
          {SOURCES.map((card) => (
            <SourceCardView
              key={card.vendor}
              card={card}
              lit={current.litSources.includes(card.vendor)}
              cardRef={(el) => { cardRefs.current[card.vendor] = el; }}
            />
          ))}
        </section>

        <div className="landing-story-flowline" aria-hidden="true"><i /></div>

        <section className="landing-story-deck" aria-label="Four-slide illustrative client deck">
          <div className="landing-story-deck-bar">
            <svg className="landing-story-doc-icon" viewBox="0 0 12 14" aria-hidden="true">
              <path d="M1 1h7l3 3v9H1z" />
              <rect x="3" y="6" width="6" height="4" />
            </svg>
            <span className="landing-story-deck-title">Bridge4 Partners · Recommendation</span>
            <span className="landing-story-deck-menu">File Edit View Insert</span>
            <span className="landing-story-deck-count">Slide {current.slide + 1} of 4</span>
          </div>
          <div className="landing-story-deck-body">
            <div ref={stripRef} className="landing-story-filmstrip" aria-hidden="true">
              {SLIDE_TITLES.map((title, index) => (
                <div key={title} className="landing-story-thumb" data-active={index === current.slide}>
                  <span>{index + 1}</span>
                  <p>{title}</p>
                </div>
              ))}
            </div>
            <div ref={slideRef} className="landing-story-slide-frame" data-testid="landing-story-slide">
              {prevSlide !== current.slide ? (
                <div className="landing-story-slide-layer landing-story-slide-old"><DeckSlide index={prevSlide} highlight={null} /></div>
              ) : null}
              <div className="landing-story-slide-layer landing-story-slide-new"><DeckSlide index={current.slide} highlight={current.highlight} /></div>
            </div>
          </div>
          <p className="landing-story-footnote landing-story-deck-note">Illustrative client recommendation</p>
        </section>

        <div className="landing-story-qa">
          <CircleDoodle className="landing-story-doodle-qa" />
          <div className="landing-story-question">
            <CircleDoodle className="landing-story-doodle-q" />
            <p className="landing-story-column-label">{current.speaker}</p>
            <blockquote>{current.question}</blockquote>
          </div>
          <div ref={responseRef} className="landing-story-response">
            <p className="landing-story-response-label">Lasso answers</p>
            <p className="landing-story-answer-copy" aria-label={current.answer}>
              {words.map((word, index) => (
                <span aria-hidden="true" key={`${word}-${index}`} style={{ animationDelay: `${3000 + index * 70}ms` }}>{word} </span>
              ))}
            </p>
            <p className="landing-story-source-line" style={{ animationDelay: `${sourceLineDelay}ms` }}>
              Open the exact source · {current.sourceCount}
            </p>
          </div>
          <div className="landing-story-steps" role="tablist" aria-label="Choose a question">
            {STORY.map((item, index) => (
              <button key={item.question} type="button" role="tab" aria-selected={step === index} aria-label={`Question ${index + 1}`} onClick={() => onStepChange?.(index)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
