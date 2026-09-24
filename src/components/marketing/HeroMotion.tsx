import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/connectors/BrandLogo";
import { VendorMark } from "@/components/marketing/VendorMark";

export function ScaledStage({ width, height, children, className = "", label }: { width: number; height: number; children: ReactNode; className?: string; label?: string }) {
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
  return <div ref={ref} className="relative w-full overflow-hidden" style={{ height: height * scale }} role={label ? "img" : undefined} aria-label={label}><div className={`landing-beats-stage absolute left-0 top-0 ${className}`} style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div></div>;
}

export type VendorGlyph = "claude" | "chatgpt" | "gemini" | "granola" | "lovable";
type SourceId = "research" | "board" | "scenarios" | "call" | "pipeline";
type SourceCard = { id: SourceId; vendor: VendorGlyph; label: string; title: string; excerpt: string };

const SOURCES: SourceCard[] = [
  { id: "research", vendor: "claude", label: "Claude · 28 Aug", title: "Comparable organizations research", excerpt: "Five regional networks, board size and partner revenue." },
  { id: "board", vendor: "claude", label: "Claude · 2 Sep", title: "Board structure options", excerpt: "Chair terms, committee shape and partner seats." },
  { id: "scenarios", vendor: "chatgpt", label: "ChatGPT · 9 Sep", title: "Partnership revenue scenarios", excerpt: "Three illustrative paths to FY27." },
  { id: "call", vendor: "granola", label: "Granola · 3 Sep", title: "Board chair call", excerpt: "Constraints, comparables and appetite for change." },
  { id: "pipeline", vendor: "lovable", label: "Lovable · 12 Sep", title: "Pipeline prototype", excerpt: "Eight prospects grouped into three tiers." },
];

function SourceGlyph({ vendor, size }: { vendor: VendorGlyph; size: number }) {
  if (vendor === "granola") return <BrandLogo brand="granola" size={size} />;
  return <VendorMark vendor={vendor} size={size} />;
}

export type StoryStep = {
  speaker: "Board chair" | "Manager question" | "Client CEO";
  question: string;
  litSources: SourceId[];
  slide: 0 | 1 | 2 | 3 | 4 | 5;
  highlight: string;
  answer: string;
  sourceCount: number;
};

export const STORY: StoryStep[] = [
  {
    speaker: "Board chair", question: "Where did the $1.4M on slide 3 come from?", litSources: ["scenarios", "pipeline"],
    slide: 2,
    highlight: "$1.4M", answer: "A scenario built in ChatGPT on 9 Sep from the pipeline prototype's tier sizes. A model, not a forecast.", sourceCount: 2,
  },
  {
    speaker: "Manager question", question: "Which comparable organizations did we research?", litSources: ["research", "call"],
    slide: 1,
    highlight: "Five organizations", answer: "Riverbend, Two Rivers, Northgate, Cedar Coast, Meridian. The chair named Riverbend on the 3 Sep call; the other four came from the research thread.", sourceCount: 2,
  },
  {
    speaker: "Client CEO", question: "Send me the link to the chat where we settled on two-term limits for the chair.", litSources: ["board"],
    slide: 3,
    highlight: "two terms of three years", answer: "Claude, 2 Sep, turn 18. That turn is where two terms of three years was chosen over one of five.", sourceCount: 1,
  },
  {
    speaker: "Manager question", question: "Which conversations shaped the recommendation?", litSources: ["board", "call", "scenarios"],
    slide: 5,
    highlight: "Set aside the merger", answer: "Three, in order: the chair call set the constraint, the board-structure thread chose the shape, the scenario thread costed the merger and set it aside.", sourceCount: 3,
  },
];

const SLIDE_TITLES = ["Harborline at a turning point.", "Five organizations we benchmarked.", "Partnership revenue to $1.4M by FY27.", "Eleven seats, three committees.", "Eight prospects, three tiers.", "Seat the partners. Set aside the merger."] as const;

function Hl({ text, phrase }: { text: string; phrase: string | null }) {
  if (!phrase) return <>{text}</>;
  const at = text.indexOf(phrase);
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<mark className="landing-story-hl">{phrase}</mark>{text.slice(at + phrase.length)}</>;
}

function SlideFooter({ index }: { index: number }) {
  return <p className="landing-story-slide-footer">Bridge4 Partners · illustrative · {index + 1} / 6</p>;
}

function DeckSlide({ index, highlight }: { index: number; highlight: string | null }) {
  if (index === 0) return <div className="landing-story-slide landing-story-slide-split"><div className="landing-story-slide-main"><p className="landing-story-kicker">01 · Where we are</p><h3>Harborline at a turning point.</h3><div className="landing-story-stat-grid"><div><strong>9</strong><span>board seats</span></div><div><strong>3</strong><span>expiring FY26</span></div><div><strong>4</strong><span>partners</span></div></div><p className="landing-story-footnote">Illustrative organization</p></div><div className="landing-story-img-placeholder" aria-label="Illustrative photo placeholder"><span>photo</span></div><SlideFooter index={index} /></div>;
  if (index === 1) {
    const rows = [["Riverbend Health Collaborative", "11", "18%"], ["Two Rivers Care Network", "13", "22%"], ["Northgate Community Health", "9", "9%"], ["Cedar Coast Alliance", "12", "15%"], ["Meridian Health Partners", "10", "27%"]];
    return <div className="landing-story-slide"><div className="landing-story-slide-main"><p className="landing-story-kicker">02 · Comparable organizations</p><h3><Hl text="Five organizations we benchmarked." phrase={highlight} /></h3><div className="landing-story-table"><div><b>Org</b><b>Board</b><b>Partner revenue</b></div>{rows.map((row) => <div key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}</div><p className="landing-story-footnote">Illustrative benchmark set</p></div><SlideFooter index={index} /></div>;
  }
  if (index === 2) return <div className="landing-story-slide"><div className="landing-story-slide-main"><p className="landing-story-kicker">03 · The number</p><h3>Partnership revenue to <Hl text="$1.4M" phrase={highlight} /> by FY27.</h3><div className="landing-story-revenue-chart" aria-label="Illustrative partnership revenue scenario"><i data-year="FY25"><span>FY25</span></i><i data-year="FY26"><span>FY26</span></i><i data-year="FY27"><span>FY27</span></i></div><p className="landing-story-footnote">illustrative scenario</p></div><SlideFooter index={index} /></div>;
  if (index === 3) return <div className="landing-story-slide"><div className="landing-story-slide-main"><p className="landing-story-kicker">04 · Board structure</p><h3>Eleven seats, three committees.</h3><div className="landing-story-org"><div className="landing-story-org-chair">Chair <small>(<Hl text="two terms of three years" phrase={highlight} />)</small></div><div className="landing-story-org-committees"><span>Board design</span><span>Partnerships</span><span>Finance &amp; Audit</span></div><div className="landing-story-org-seats"><span>2 partner seats</span><span>9 community seats</span></div></div><p className="landing-story-footnote">Illustrative board model</p></div><SlideFooter index={index} /></div>;
  if (index === 4) return <div className="landing-story-slide"><div className="landing-story-slide-main"><p className="landing-story-kicker">05 · Partnership pipeline</p><h3>Eight prospects, three tiers.</h3><div className="landing-story-tier-bar"><i data-tier="one"><b>3</b><span>Tier 1</span></i><i data-tier="two"><b>3</b><span>Tier 2</span></i><i data-tier="three"><b>2</b><span>Tier 3</span></i></div><p className="landing-story-footnote">Illustrative pipeline</p></div><SlideFooter index={index} /></div>;
  return <div className="landing-story-slide"><div className="landing-story-slide-main"><p className="landing-story-kicker">06 · Recommendation</p><h3>Seat the partners. <Hl text="Set aside the merger." phrase={highlight} /></h3><div className="landing-story-timeline"><div><b>1–30</b><span>board vote</span></div><div><b>31–60</b><span>partner seats filled</span></div><div><b>61–90</b><span>first tier-1 agreement</span></div></div><p className="landing-story-footnote">Illustrative 90-day plan</p></div><SlideFooter index={index} /></div>;
}

function SourceCardView({ card, lit, cardRef }: { card: SourceCard; lit: boolean; cardRef?: (el: HTMLElement | null) => void }) {
  return <article ref={cardRef} className="landing-story-source" data-lit={lit} data-source-id={card.id} data-vendor={card.vendor}><header><SourceGlyph vendor={card.vendor} size={20} /><span>{card.label}</span></header><h3>{card.title}</h3><p>{card.excerpt}</p></article>;
}

export function ClosedAuditLine({ count }: { count: number }) { return <div className="landing-story-evidence-line"><span>Open the exact source</span><small>{count} source{count === 1 ? "" : "s"}</small></div>; }
export function StepRow({ label, className = "" }: { g?: "doc" | "chat" | "lens" | "link"; label: string; className?: string }) { return <div className={`landing-story-step ${className}`}><span aria-hidden="true" /><span>{label}</span></div>; }
export type PreviewCardData = { vendor: VendorGlyph; label?: string; tool?: string; when?: string; title: string; excerpt?: string; summary?: string; url?: string; left?: number; top?: number };
export function PreviewCard({ card }: { card: PreviewCardData; style?: React.CSSProperties }) { return <SourceCardView card={{ id: "research", vendor: card.vendor, label: card.label ?? `${card.tool ?? ""} ${card.when ?? ""}`, title: card.title, excerpt: card.excerpt ?? card.summary ?? "" }} lit />; }

function SourceChip({ card }: { card: SourceCard }) {
  return <span className="lw-chip" data-source-id={card.id}><SourceGlyph vendor={card.vendor} size={14} /><span>{card.title}</span></span>;
}

function sourceLineFor(index: number, step: StoryStep) {
  return index === 2 ? "Open the exact turn · 1" : `Open the exact source · ${step.sourceCount}`;
}

function litCards(step: StoryStep) {
  return step.litSources.map((id) => SOURCES.find((item) => item.id === id)).filter((card): card is SourceCard => Boolean(card));
}

function DeckFrame({ step, stepIndex }: { step: StoryStep; stepIndex: number }) {
  return <section className="landing-story-deck lw-deck" aria-label="Six-slide illustrative client deck"><div className="landing-story-deck-bar"><svg className="landing-story-doc-icon" viewBox="0 0 12 14" aria-hidden="true"><path d="M1 1h7l3 3v9H1z" /><rect x="3" y="6" width="6" height="4" /></svg><span className="landing-story-deck-title">Harborline Health Alliance · Growth partnerships and board structure, FY27</span><span className="landing-story-deck-menu">File Edit View Insert</span><span className="landing-story-deck-count">Slide {step.slide + 1} of 6</span></div><div className="landing-story-deck-body"><div className="landing-story-filmstrip" aria-hidden="true">{SLIDE_TITLES.map((title, index) => <div key={title} className="landing-story-thumb" data-active={index === step.slide}><span>{index + 1}</span><p>{title}</p></div>)}</div><div className="landing-story-slide-frame" data-testid="landing-story-slide" data-slide={step.slide} data-step={stepIndex}><div key={step.slide} className="landing-story-slide-layer lw-slide-in"><DeckSlide index={step.slide} highlight={step.highlight} /></div></div></div><p className="landing-story-footnote landing-story-deck-note">Illustrative client recommendation</p></section>;
}

/**
 * Unit 10: the deck-pinned walkthrough. Four steps stacked on the left; the
 * step nearest the viewport centre drives the sticky deck on the right.
 * Scroll-driven with IntersectionObserver. No timers.
 */
export function DeckWalkthrough({ onActiveChange }: { onActiveChange?: (index: number) => void }) {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLElement | null)[]>([]);
  const report = useRef(onActiveChange);
  report.current = onActiveChange;

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const index = stepRefs.current.indexOf(entry.target as HTMLElement);
        if (index >= 0) setActive(index);
      }
    }, { rootMargin: "-50% 0px -50% 0px", threshold: 0 });
    for (const el of stepRefs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { report.current?.(active); }, [active]);

  const fallback = STORY[0];
  if (!fallback) return null;
  const current = STORY[active] ?? fallback;

  return <div className="lw-grid" data-active-step={active}>
    <div className="lw-steps">
      {STORY.map((step, index) => <article key={step.question} ref={(el) => { stepRefs.current[index] = el; }} className="lw-step" data-story-index={index} data-active={index === active}>
        <p className="lw-speaker">{step.speaker}</p>
        <h3 className="lw-question">{step.question}</h3>
        <div className="lw-answer"><p>{step.answer}</p><p className="lw-source-line">{sourceLineFor(index, step)}</p></div>
        <div className="lw-chips">{litCards(step).map((card) => <SourceChip key={card.id} card={card} />)}</div>
        <div className="lw-phone-only">
          <p className="lw-phone-label">What Lasso read</p>
          <div className="lw-phone-sources">{litCards(step).map((card) => <SourceCardView key={card.id} card={card} lit />)}</div>
          <div className="lw-phone-slide"><div className="landing-story-slide-frame"><div className="landing-story-slide-layer"><DeckSlide index={step.slide} highlight={step.highlight} /></div></div><p className="landing-story-footnote landing-story-deck-note">Slide {step.slide + 1} of 6 · illustrative</p></div>
        </div>
      </article>)}
    </div>
    <div className="lw-stage">
      <div className="lw-sticky">
        <DeckFrame step={current} stepIndex={active} />
        <div className="lw-lit-sources" aria-label="What Lasso read">{litCards(current).map((card) => <SourceCardView key={`${active}-${card.id}`} card={card} lit />)}</div>
      </div>
    </div>
  </div>;
}
