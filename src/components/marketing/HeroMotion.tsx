import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import audienceImage from "@/assets/landing-audience.jpg";
import { VendorMark, type VendorKey } from "@/components/marketing/VendorMark";

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

export type VendorGlyph = "claude" | "chatgpt" | "gemini" | "granola";

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
];

export const STORY_QUESTIONS = [
  "Where did the 18% on slide 3 come from?",
  "Find the link to the Claude conversation where I said ‘xyz’.",
  "What did we consider and reject?",
  "Which conversations shaped the recommendation?",
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
    <article className="landing-story-source" data-source-active={active === index || (active === 3 && index < 2)}>
      <header>{card.vendor === "granola" ? <span className="landing-story-granola" aria-hidden="true">G</span> : <VendorMark vendor={card.vendor} size={24} />}<span>{card.label}</span></header>
      <h3>{card.title}</h3>
      <p>{card.excerpt}</p>
    </article>
  );
}

export function ClosedAuditLine({ count }: { count: number }) {
  return <div className="landing-story-evidence-line"><span>Open the exact source</span><small>{count} source{count === 1 ? "" : "s"}</small></div>;
}

export function StepRow({ label, className = "" }: { g?: "doc" | "chat" | "lens" | "link"; label: string; className?: string }) {
  return <div className={`landing-story-step ${className}`}><span aria-hidden="true" /><span>{label}</span></div>;
}

export type PreviewCardData = SourceCard & { tool?: string; when?: string; summary?: string; url?: string; left?: number; top?: number };
export function PreviewCard({ card }: { card: PreviewCardData; style?: React.CSSProperties }) {
  return <SourceCardView card={{ vendor: card.vendor, label: card.label ?? `${card.tool ?? ""} ${card.when ?? ""}`, title: card.title, excerpt: card.excerpt ?? card.summary ?? "" }} index={0} active={0} />;
}

export function HeroMotion({ activeSlide = 0, onSlideChange }: { activeSlide?: number; onSlideChange?: (index: number) => void }) {
  const question = STORY_QUESTIONS[activeSlide] ?? STORY_QUESTIONS[0];
  return (
    <div className="landing-story-shell" aria-label="AI conversations becoming a client deck, with the source behind each answer">
      <div className="landing-story-canvas landing-beats-dots">
        <section className="landing-story-sources" aria-label="Source conversations">
          <p className="landing-story-column-label">Work conversations</p>
          {SOURCES.map((card, index) => <SourceCardView key={card.vendor} card={card} index={index} active={activeSlide} />)}
        </section>

        <div className="landing-story-flow" aria-hidden="true"><i /><i /><i /></div>

        <section className="landing-story-deck" aria-label="Four-slide illustrative client deck">
          <div className="landing-story-deck-bar"><span>Illustrative client recommendation</span><small>4 slides</small></div>
          <div className="landing-story-deck-window"><DeckSlide index={activeSlide} /></div>
          <div className="landing-story-pagination" role="tablist" aria-label="Choose a deck slide">
            {[0, 1, 2, 3].map((index) => (
              <button key={index} type="button" role="tab" aria-selected={activeSlide === index} aria-label={`Slide ${index + 1}`} onClick={() => onSlideChange?.(index)} />
            ))}
          </div>
        </section>

        <div className="landing-story-answer">
          <p className="landing-story-column-label">A question about the work</p>
          <blockquote key={question}>{question}</blockquote>
          <div className="landing-story-answer-path"><i /><span>{activeSlide === 1 ? "Claude · Audience strategy · exact turn" : activeSlide === 2 ? "Scenario model · pricing assumption" : activeSlide === 3 ? "Three conversations · recommendation" : "Audience strategy · supporting evidence"}</span></div>
          <p className="landing-story-answer-copy">
            {activeSlide === 1 ? "Here is the conversation and the exact place where ‘xyz’ appears." : activeSlide === 2 ? "The 18% came from the illustrative scenario model and was carried into slide 3." : activeSlide === 3 ? "The recommendation kept the fan vote and set paid acquisition aside." : "The audience pattern came from the channel and event conversations."}
          </p>
        </div>
      </div>
    </div>
  );
}