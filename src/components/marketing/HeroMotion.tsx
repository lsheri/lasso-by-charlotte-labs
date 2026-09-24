import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

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

export const STORY_QUESTIONS = [
  "Which conversations shaped the recommendation?",
  "Find the link to the Claude conversation where I said ‘xyz’.",
  "Where did the 18% on slide 3 come from?",
  "What did we consider and reject?",
] as const;

const STORY_QUESTION_SPEAKERS = ["Client question", "Manager question", "Client question", "Manager question"] as const;
const STORY_ANSWER_PATHS = [
  "Audience strategy · supporting evidence",
  "Claude · Audience strategy · exact turn",
  "Scenario model · pricing assumption",
  "Three conversations · recommendation",
] as const;
const STORY_ANSWERS = [
  "The audience pattern came from the channel and event conversations.",
  "Here is the conversation and the exact place where ‘xyz’ appears.",
  "The 18% came from the illustrative scenario model and was carried into slide 3.",
  "The recommendation kept the fan vote and set paid acquisition aside.",
] as const;

function MiniBars() {
  return (
    <div className="landing-story-bars" aria-hidden="true">
      <i data-value="short" /><i data-value="events" /><i data-value="email" />
    </div>
  );
}

function DeckSlide({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="landing-story-slide landing-story-slide-audience">
        <div>
          <p className="landing-story-kicker">01 · Audience signal</p>
          <h3>Attention lives in the moments between events.</h3>
          <p>Short clips carried the strongest response in this illustrative case.</p>
          <MiniBars />
        </div>
        <img src={audienceImage} alt="Illustrative audience at an outdoor event" width={1280} height={800} />
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="landing-story-slide landing-story-slide-channel">
        <p className="landing-story-kicker">02 · Channel evidence</p>
        <h3>One moment. Three ways to carry it.</h3>
        <div className="landing-story-channel-grid">
          <div><strong>2.4×</strong><span>Short-form response</span></div>
          <div><strong>1.6×</strong><span>Community response</span></div>
          <div><strong>1.0×</strong><span>Email baseline</span></div>
        </div>
        <p className="landing-story-footnote">Illustrative comparison, not customer results</p>
      </div>
    );
  }
  if (index === 2) {
    return (
      <div className="landing-story-slide landing-story-slide-commercial">
        <p className="landing-story-kicker">03 · Commercial case</p>
        <h3>Bundle the experience, not just the seat.</h3>
        <div className="landing-story-metric"><strong>18%</strong><span>illustrative bundle uplift</span></div>
        <div className="landing-story-waterfall" aria-hidden="true"><i /><i /><i /><i /></div>
        <p className="landing-story-footnote">Source: scenario model and pricing conversations</p>
      </div>
    );
  }
  return (
    <div className="landing-story-slide landing-story-slide-choice">
      <p className="landing-story-kicker">04 · Recommendation</p>
      <h3>Build participation into the event.</h3>
      <div className="landing-story-choice-row"><span>Choose</span><strong>Weekly fan vote</strong><small>Turns rule changes into moments people own</small></div>
      <div className="landing-story-choice-row" data-choice="rejected"><span>Set aside</span><strong>Paid acquisition</strong><small>Did not clear the illustrative cost-to-serve case</small></div>
    </div>
  );
}

function SourceCardView({ card, index, active }: { card: SourceCard; index: number; active: number }) {
  return (
    <article className="landing-story-source" data-source-active={active === index || (active === 3 && index < 2) || (active === 0 && index === 4)}>
      <header><SourceGlyph vendor={card.vendor} size={24} /><span>{card.label}</span></header>
      <h3>{card.title}</h3>
      <p>{card.excerpt}</p>
    </article>
  );
}

function ConversationTunnel() {
  const fragments = [
    { vendor: "claude" as const, excerpt: "Rule-change moments…" },
    { vendor: "chatgpt" as const, excerpt: "Short-form clips…" },
    { vendor: "gemini" as const, excerpt: "18% bundle uplift…" },
    { vendor: "granola" as const, excerpt: "Which audience first…" },
    { vendor: "lovable" as const, excerpt: "Clickable bundle page…" },
  ];

  return (
    <div className="landing-story-flow" aria-hidden="true">
      <div className="landing-story-vortex-core" />
      <div className="landing-story-vortex-rings">
        <i /><i /><i /><i /><i />
      </div>
      <div className="landing-story-vortex-streams"><i /><i /><i /></div>
      {fragments.map((fragment, index) => (
        <div className="landing-story-vortex-fragment" data-fragment={index + 1} key={fragment.vendor}>
          <SourceGlyph vendor={fragment.vendor} size={18} />
          <span>{fragment.excerpt}</span>
        </div>
      ))}
    </div>
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
  return <SourceCardView card={{ vendor: card.vendor, label: card.label ?? `${card.tool ?? ""} ${card.when ?? ""}`, title: card.title, excerpt: card.excerpt ?? card.summary ?? "" }} index={0} active={0} />;
}

export function HeroMotion({ activeSlide = 0, onSlideChange }: { activeSlide?: number; onSlideChange?: (index: number) => void }) {
  const question = STORY_QUESTIONS[activeSlide] ?? STORY_QUESTIONS[0];
  const speaker = STORY_QUESTION_SPEAKERS[activeSlide] ?? STORY_QUESTION_SPEAKERS[0];
  const path = STORY_ANSWER_PATHS[activeSlide] ?? STORY_ANSWER_PATHS[0];
  const answer = STORY_ANSWERS[activeSlide] ?? STORY_ANSWERS[0];
  return (
    <div className="landing-story-shell" aria-label="AI conversations becoming a client deck, with the source behind each answer">
      <div className="landing-story-canvas landing-beats-dots">
        <section className="landing-story-sources" aria-label="Source conversations">
          <p className="landing-story-column-label">Work conversations</p>
          {SOURCES.map((card, index) => <SourceCardView key={card.vendor} card={card} index={index} active={activeSlide} />)}
        </section>

        <ConversationTunnel />
        <div className="landing-story-reach" aria-hidden="true" key={`reach-${activeSlide}`}>
          <div className="landing-story-reach-stream" />
          {SOURCES.map((card, index) => (
            <div className="landing-story-reach-word" data-reach={index + 1} key={card.vendor}>
              <SourceGlyph vendor={card.vendor} size={12} />
              <span>{card.title}</span>
            </div>
          ))}
        </div>

        <section className="landing-story-deck" aria-label="Four-slide illustrative client deck">
          <div className="landing-story-deck-bar"><span>Illustrative client recommendation</span><small>4 slides</small></div>
          <div className="landing-story-deck-window"><DeckSlide index={activeSlide} /></div>
          <div className="landing-story-pagination" role="tablist" aria-label="Choose a deck slide">
            {[0, 1, 2, 3].map((index) => (
              <button key={index} type="button" role="tab" aria-selected={activeSlide === index} aria-label={`Slide ${index + 1}`} onClick={() => onSlideChange?.(index)} />
            ))}
          </div>
        </section>

        <div className="landing-story-answer" key={question}>
          <svg className="landing-story-doodle" viewBox="0 0 400 520" preserveAspectRatio="none" aria-hidden="true">
            <path pathLength={1} d="M206 14C318 10 392 70 390 214c-2 150-40 282-196 292C58 514 10 420 12 262 14 106 70 20 214 22c40 1 74 8 104 22" />
          </svg>
          <div className="landing-story-question">
            <p className="landing-story-column-label">{speaker}</p>
            <blockquote>{question}</blockquote>
          </div>
          <div className="landing-story-response">
            <p className="landing-story-response-label">Lasso answers</p>
            <div className="landing-story-answer-path"><i /><span>{path}</span></div>
            <p className="landing-story-answer-copy" aria-label={answer}>
              {answer.split(" ").map((word, index) => (
                <span aria-hidden="true" key={`${word}-${index}`} style={{ animationDelay: `${900 + index * 70}ms` }}>{word} </span>
              ))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}