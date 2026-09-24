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

type FlowPaths = { streams: { id: SourceId; vendor: VendorGlyph; d: string }[]; chip: string; w: number; h: number } | null;
function ConversationTunnel({ paths, step }: { paths: FlowPaths; step: StoryStep }) {
  if (!paths) return null;
  return <div className="landing-story-flow" aria-hidden="true"><svg width={paths.w} height={paths.h} viewBox={`0 0 ${paths.w} ${paths.h}`}>{paths.streams.map((stream) => <path key={stream.id} className="landing-story-stream" d={stream.d} pathLength={1} />)}<path className="landing-story-stream landing-story-stream-merged" d={paths.chip} pathLength={1} /></svg>{paths.streams.map((stream) => <div className="landing-story-fragment" key={stream.id} style={{ offsetPath: `path("${stream.d}")` }}><SourceGlyph vendor={stream.vendor} size={14} /><span>{SOURCES.find((item) => item.id === stream.id)?.title}</span></div>)}<div className="landing-story-reach-chip" style={{ offsetPath: `path("${paths.chip}")` }}>{step.sourceCount} source{step.sourceCount === 1 ? "" : "s"}</div></div>;
}

function CircleDoodle() { return <svg className="landing-story-doodle landing-story-doodle-qa" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true"><path pathLength={1} vectorEffect="non-scaling-stroke" d="M214 10C330 8 394 58 392 146c-2 92-56 146-196 148C62 296 8 236 10 150 12 66 74 14 208 14c44 1 80 8 112 24" /></svg>; }
export function ClosedAuditLine({ count }: { count: number }) { return <div className="landing-story-evidence-line"><span>Open the exact source</span><small>{count} source{count === 1 ? "" : "s"}</small></div>; }
export function StepRow({ label, className = "" }: { g?: "doc" | "chat" | "lens" | "link"; label: string; className?: string }) { return <div className={`landing-story-step ${className}`}><span aria-hidden="true" /><span>{label}</span></div>; }
export type PreviewCardData = { vendor: VendorGlyph; label?: string; tool?: string; when?: string; title: string; excerpt?: string; summary?: string; url?: string; left?: number; top?: number };
export function PreviewCard({ card }: { card: PreviewCardData; style?: React.CSSProperties }) { return <SourceCardView card={{ id: "research", vendor: card.vendor, label: card.label ?? `${card.tool ?? ""} ${card.when ?? ""}`, title: card.title, excerpt: card.excerpt ?? card.summary ?? "" }} lit />; }

const LEAVE_MS = 700;
export function HeroMotion({ step = 0, onStepChange }: { step?: number; onStepChange?: (index: number) => void }) {
  const [shown, setShown] = useState(step);
  const [prevSlide, setPrevSlide] = useState<number>(STORY[step]?.slide ?? 2);
  const [leaving, setLeaving] = useState(false);
  const [paths, setPaths] = useState<FlowPaths>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const slideRef = useRef<HTMLDivElement | null>(null);
  const responseRef = useRef<HTMLDivElement | null>(null);
  const fallbackStory = STORY[0];
  if (!fallbackStory) return null;
  const current = STORY[shown] ?? fallbackStory;

  useEffect(() => {
    if (step === shown) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setLeaving(true);
    const timer = setTimeout(() => { setPrevSlide((STORY[shown] ?? fallbackStory).slide); setShown(step); setLeaving(false); }, reduced ? 0 : LEAVE_MS);
    return () => clearTimeout(timer);
  }, [step, shown]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measure = () => {
      if (window.matchMedia("(max-width: 767px)").matches) return setPaths(null);
      const c = canvas.getBoundingClientRect();
      const slide = slideRef.current?.getBoundingClientRect();
      const response = responseRef.current?.getBoundingClientRect();
      if (!slide || !response || slide.width === 0) return setPaths(null);
      const mx = slide.left - c.left;
      const my = slide.top - c.top + slide.height / 2;
      const streams = current.litSources.map((id) => {
        const source = SOURCES.find((item) => item.id === id);
        if (!source) return null;
        const card = cardRefs.current[id]?.getBoundingClientRect();
        const sx = card ? card.right - c.left : 0;
        const sy = card ? card.top - c.top + card.height / 2 : my;
        const dx = Math.max(24, (mx - sx) / 2);
        return { id, vendor: source.vendor, d: `M${sx.toFixed(1)} ${sy.toFixed(1)} C${(sx + dx).toFixed(1)} ${sy.toFixed(1)} ${(mx - dx).toFixed(1)} ${my.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}` };
      }).filter((stream): stream is { id: SourceId; vendor: VendorGlyph; d: string } => stream !== null);
      const ax = slide.right - c.left;
      const bx = response.left - c.left;
      const by = response.top - c.top + Math.min(40, response.height / 2);
      const chip = `M${ax.toFixed(1)} ${my.toFixed(1)} C${((ax + bx) / 2).toFixed(1)} ${my.toFixed(1)} ${((ax + bx) / 2).toFixed(1)} ${by.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
      setPaths({ streams, chip, w: c.width, h: c.height });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(canvas);
    return () => observer?.disconnect();
  }, [shown]);

  const orderedSources = [...SOURCES].sort((a, b) => Number(current.litSources.includes(b.id)) - Number(current.litSources.includes(a.id)));
  const words = current.answer.split(" ");
  const sourceLineDelay = 3000 + words.length * 70 + 120;
  const sourceLine = shown === 2 ? "Open the exact turn · 1" : `Open the exact source · ${current.sourceCount}`;

  return <div className="landing-story-shell" aria-label="AI conversations connected to an illustrative client deck">
    <div ref={canvasRef} className="landing-story-canvas" data-leaving={leaving} key={shown}>
      <ConversationTunnel paths={paths} step={current} />
      <div className="landing-story-qa">
        <CircleDoodle />
        <div className="landing-story-question"><p className="landing-story-column-label">{current.speaker}</p><blockquote>{current.question}</blockquote></div>
        <div ref={responseRef} className="landing-story-response"><p className="landing-story-response-label">Lasso answers</p><p className="landing-story-answer-copy" aria-label={current.answer}>{words.map((word, index) => <span aria-hidden="true" key={`${word}-${index}`} style={{ animationDelay: `${3000 + index * 70}ms` }}>{word} </span>)}</p><p className="landing-story-source-line" style={{ animationDelay: `${sourceLineDelay}ms` }}>{sourceLine}</p></div>
      </div>
      <section className="landing-story-sources" aria-label="What Lasso read"><p className="landing-story-mobile-label">What Lasso read</p><div className="landing-story-source-list">{orderedSources.map((card) => <SourceCardView key={card.id} card={card} lit={current.litSources.includes(card.id)} cardRef={(el) => { cardRefs.current[card.id] = el; }} />)}</div></section>
      <section className="landing-story-deck" aria-label="Six-slide illustrative client deck"><p className="landing-story-mobile-label">On the slide</p><div className="landing-story-deck-bar"><svg className="landing-story-doc-icon" viewBox="0 0 12 14" aria-hidden="true"><path d="M1 1h7l3 3v9H1z" /><rect x="3" y="6" width="6" height="4" /></svg><span className="landing-story-deck-title">Harborline Health Alliance · Growth partnerships and board structure, FY27</span><span className="landing-story-deck-menu">File Edit View Insert</span><span className="landing-story-deck-count">Slide {current.slide + 1} of 6</span></div><div className="landing-story-deck-body"><div className="landing-story-filmstrip" aria-hidden="true">{SLIDE_TITLES.map((title, index) => <div key={title} className="landing-story-thumb" data-active={index === current.slide}><span>{index + 1}</span><p>{title}</p></div>)}</div><div ref={slideRef} className="landing-story-slide-frame" data-testid="landing-story-slide">{prevSlide !== current.slide ? <div className="landing-story-slide-layer landing-story-slide-old"><DeckSlide index={prevSlide} highlight={null} /></div> : null}<div className="landing-story-slide-layer landing-story-slide-new"><DeckSlide index={current.slide} highlight={current.highlight} /></div></div></div><p className="landing-story-footnote landing-story-deck-note">Illustrative client recommendation</p></section>
      <div className="landing-story-mobile-nav"><span>Slide {current.slide + 1} of 6</span><div className="landing-story-steps" role="tablist" aria-label="Choose a question">{STORY.map((item, index) => <button key={item.question} type="button" role="tab" aria-selected={step === index} aria-label={`Question ${index + 1}`} onClick={() => onStepChange?.(index)} />)}</div></div>
    </div>
  </div>;
}
