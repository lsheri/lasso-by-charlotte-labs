import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";

/**
 * A fixed size stage scaled to its container's width. One ResizeObserver on
 * the container is the only script; every animation inside stays CSS.
 */
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
    <div
      ref={ref}
      className={`relative w-full overflow-hidden ${className}`}
      style={{ height: height * scale }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <div
        className="landing-beats-stage absolute left-0 top-0"
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        {children}
      </div>
    </div>
  );
}

const C = {
  ink: "var(--landing-beats-ink)",
  graphite: "var(--landing-beats-graphite)",
  muted: "var(--landing-beats-muted)",
  paper: "var(--landing-beats-paper)",
  hairline: "var(--landing-beats-hairline)",
  quiet: "var(--landing-beats-quiet-ink)",
  connector: "var(--landing-beats-connector)",
  node: "var(--landing-beats-node)",
  fragLine: "var(--landing-beats-frag-line)",
  softRule: "var(--landing-beats-soft-rule)",
  faintRule: "var(--landing-beats-faint-rule)",
  avatar: "var(--landing-beats-avatar)",
  trunkA: "var(--landing-beats-trunk-a)",
  trunkB: "var(--landing-beats-trunk-b)",
  brand: "var(--landing-beats-brand)",
  lime: "var(--landing-beats-lime)",
} as const;

export type VendorGlyph = "claude" | "gemini" | "chatgpt" | "granola";

export function VendorGlyphSvg({ vendor }: { vendor: VendorGlyph }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={C.graphite} strokeWidth="1.3">
      {vendor === "claude" ? <path d="M8 2.2 13 5v6l-5 2.8L3 11V5z" /> : null}
      {vendor === "gemini" ? (
        <>
          <circle cx="8" cy="8" r="5.4" />
          <path d="M8 2.6v10.8M2.6 8h10.8" />
        </>
      ) : null}
      {vendor === "chatgpt" ? <path d="M3.2 6.2 8 3.4l4.8 2.8v3.6L8 12.6 3.2 9.8z" /> : null}
      {vendor === "granola" ? (
        <>
          <rect x="3" y="3" width="10" height="10" rx="2" />
          <path d="M5.5 7h5M5.5 9.5h3" />
        </>
      ) : null}
    </svg>
  );
}

function LinkGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke={C.muted} strokeWidth="1.5">
      <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.8.8" />
      <path d="M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.8-.8" />
    </svg>
  );
}

export type PreviewCardData = {
  vendor: VendorGlyph;
  tool: string;
  when: string;
  title: string;
  summary: string;
  url: string;
  left: number;
  top: number;
};

export function PreviewCard({ card, style }: { card: PreviewCardData; style?: CSSProperties }) {
  return (
    <div className="landing-beats-prev landing-beats-paper" style={{ left: card.left, top: card.top, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <VendorGlyphSvg vendor={card.vendor} />
        <span className="landing-beats-tool">{card.tool}</span>
        <span className="landing-beats-when">{card.when}</span>
      </div>
      <div className="landing-beats-ttl">{card.title}</div>
      <div className="landing-beats-sum">{card.summary}</div>
      <div className="landing-beats-url">
        <LinkGlyph />
        {card.url}
      </div>
    </div>
  );
}

const CARDS_A: PreviewCardData[] = [
  { vendor: "claude", tool: "Claude", when: "Pushed 14 Aug", title: "Rate card v3 walkthrough", summary: "Worked the uplift from the Q3 rate card and kept 18% across all segments.", url: "claude.ai/chat/rate-card-v3", left: 112, top: 356 },
  { vendor: "gemini", tool: "Gemini", when: "Pushed 9 Aug", title: "Discount floor by segment", summary: "Tested where the floor breaks. Holds at 12% for the mid tier.", url: "gemini.google.com/app/8f21c", left: 322, top: 356 },
  { vendor: "chatgpt", tool: "ChatGPT", when: "Pushed 21 Aug", title: "Uplift maths, second pass", summary: "Re-ran the model. Carried the 18% through unchanged.", url: "chatgpt.com/c/7ad0-uplift", left: 212, top: 452 },
];

const CARDS_B: PreviewCardData[] = [
  { vendor: "chatgpt", tool: "ChatGPT", when: "Pushed 2 Sep", title: "Short-form, where fans already are", summary: "Clip length, posting cadence and which moments travel.", url: "chatgpt.com/c/1b93-clips", left: 136, top: 630 },
  { vendor: "claude", tool: "Claude", when: "Pushed 6 Sep", title: "The fan vote idea", summary: "Turn next week's rule change into a public vote the crowd owns.", url: "claude.ai/chat/fan-vote", left: 346, top: 630 },
  { vendor: "gemini", tool: "Gemini", when: "Pushed 11 Sep", title: "Paid acquisition, considered", summary: "Priced it out and dropped it. Cost to serve did not clear.", url: "gemini.google.com/app/4c07e", left: 236, top: 726 },
];

const TAIL = " C 600,470 612,580 640,580 L1000,580 C 1044,580 1056,500 1090,452";
const TAIL_B = " C 616,740 618,620 640,580 L1000,580 C 1044,580 1056,500 1090,452";
const P_A1 = `M312,412 C 390,412 500,470 566,470${TAIL}`;
const P_A2 = `M412,508 C 470,508 520,470 566,470${TAIL}`;
const P_A3 = `M522,412 C 540,412 552,450 566,470${TAIL}`;
const P_B2 = `M546,686 C 566,686 582,710 590,740${TAIL_B}`;
const P_B3 = `M436,782 C 500,782 560,745 590,740${TAIL_B}`;

type Frag = { text: string; path: string; cls?: string; delay?: string; rest?: number };
const FRAGS: Frag[] = [
  { text: "\u201c18% across all segments\u201d", path: P_A1, rest: 0 },
  { text: "\u201ccarried through unchanged\u201d", path: P_A2, delay: ".42s, .42s", rest: 1 },
  { text: "\u201cfloor holds at 12%\u201d", path: P_A3, delay: ".84s, .84s", rest: 2 },
  { text: "\u201cthe crowd owns the vote\u201d", path: P_B2, cls: "landing-beats-c2" },
  { text: "\u201cnext week\u2019s rule change\u201d", path: P_B2, cls: "landing-beats-c2", delay: "14.42s, 14.42s" },
  { text: "claude.ai/chat/fan-vote", path: P_B2, cls: "landing-beats-c2", delay: "14.84s, 14.84s" },
  { text: "\u201cpriced it out and dropped it\u201d", path: P_B3, cls: "landing-beats-c3" },
  { text: "\u201ccost to serve did not clear\u201d", path: P_B3, cls: "landing-beats-c3", delay: "28.42s, 28.42s" },
  { text: "\u201c18% across all segments\u201d", path: P_A1, cls: "landing-beats-c4" },
];

type Glyph = "doc" | "chat" | "lens" | "link";
function StepGlyph({ g }: { g: Glyph }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={C.graphite} strokeWidth="1.35">
      {g === "doc" ? (
        <>
          <path d="M4 2.6h5.2L12 5.4v8H4z" />
          <g className="landing-beats-mline">
            <path d="M6 8h4M6 10.4h3" />
          </g>
        </>
      ) : null}
      {g === "chat" ? <path d="M2.8 4.2h10.4v6.2H7.6L4.6 12.6v-2.2H2.8z" /> : null}
      {g === "lens" ? (
        <g className="landing-beats-mlens">
          <circle cx="7" cy="7" r="4.2" />
          <path d="M10.2 10.2 13.4 13.4" />
        </g>
      ) : null}
      {g === "link" ? (
        <g className="landing-beats-mlens">
          <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.8.8" />
          <path d="M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.8-.8" />
        </g>
      ) : null}
    </svg>
  );
}

export function StepRow({ g, label, className = "" }: { g: Glyph; label: string; className?: string }) {
  return (
    <div className={`landing-beats-step ${className}`}>
      <span className="landing-beats-g">
        <StepGlyph g={g} />
      </span>
      <span className="landing-beats-l">{label}</span>
    </div>
  );
}

export function AskMark({ className }: { className?: string }) {
  return (
    <svg className={className} style={{ flex: "none" }} width="22" height="22" viewBox="0 0 26 26" fill="none">
      <ellipse cx="13" cy="13" rx="8" ry="2.4" stroke={C.lime} strokeWidth="1.5" />
    </svg>
  );
}

type Question = {
  n: 1 | 2 | 3 | 4;
  ask: string;
  thinkTop: number;
  reading: string;
  steps: { g: Glyph; label: string }[];
  answer: ReactNode;
  ruleHeight: number;
  count: number;
};

const QUESTIONS: Question[] = [
  {
    n: 1,
    ask: "Where does the 18% on slide 3 come from?",
    thinkTop: 46,
    reading: "Reading 3 conversations",
    steps: [
      { g: "doc", label: "Rate card v3" },
      { g: "chat", label: "Uplift maths" },
      { g: "lens", label: "Discount floor" },
    ],
    answer: "Rate card v3, 14 Aug. Carried into the model unchanged and never re-cut.",
    ruleHeight: 92,
    count: 3,
  },
  {
    n: 2,
    ask: "Where\u2019s the link to the conversation that talked about the fan vote?",
    thinkTop: 60,
    reading: "Reading 1 conversation",
    steps: [
      { g: "chat", label: "The fan vote idea" },
      { g: "link", label: "Finding the link" },
    ],
    answer: (
      <>
        Claude, 6 Sep. Opens where the idea was first written down.
        <br />
        <span style={{ color: C.quiet, textDecoration: "underline" }}>claude.ai/chat/fan-vote</span>
      </>
    ),
    ruleHeight: 92,
    count: 1,
  },
  {
    n: 3,
    ask: "What did we consider and reject?",
    thinkTop: 46,
    reading: "Reading 1 conversation",
    steps: [
      { g: "doc", label: "Paid acquisition" },
      { g: "lens", label: "Cost to serve" },
    ],
    answer: "Paid acquisition, priced and dropped on cost to serve. It is on slide 4.",
    ruleHeight: 92,
    count: 1,
  },
  {
    n: 4,
    ask: "Is this the same 18% as the board pack?",
    thinkTop: 46,
    reading: "Reading 1 conversation",
    steps: [{ g: "doc", label: "Rate card v3" }],
    answer:
      "It matches the model. The board pack is not on this board, so there is nothing here to check it against.",
    ruleHeight: 104,
    count: 1,
  },
];

const SLIDES = [
  { title: "Where the audience already is", body: <>Short-form carries the moments. Post the rule breaks, not the recaps.</> },
  { title: "Let the crowd write the rules", body: <>A weekly public vote on next week&rsquo;s rule change. The fans own the outcome.</> },
  {
    title: "Ticket bundles",
    body: (
      <>
        Recommended uplift of{" "}
        <span style={{ position: "relative", display: "inline-block", color: C.ink, fontWeight: 500 }}>
          18% across all segments
          <span
            className="landing-beats-uline"
            style={{ position: "absolute", left: 0, bottom: -1, width: "100%", height: 1, background: C.ink }}
          />
        </span>
        , carried from the model.
      </>
    ),
  },
  { title: "Considered and dropped", body: <>Paid acquisition was priced and rejected. Cost to serve did not clear.</> },
];

export function ClosedAuditLine({ count }: { count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <svg width="10" height="10" viewBox="0 0 11 11" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round">
        <path d="M4 2l4 3.5L4 9" />
      </svg>
      <span style={{ fontSize: 11.5, color: C.quiet }}>Read what went into this response</span>
      <span className="landing-beats-mono" style={{ fontSize: 9.5, color: C.muted, marginLeft: "auto" }}>
        {count}
      </span>
    </div>
  );
}

/** The artboard's full 1440x900 frame, offset so its stage (y 296) is the top. */
function Artboard() {
  return (
    <div style={{ position: "absolute", left: 0, top: -296, width: 1440, height: 900 }}>
      <div className="landing-beats-dots" style={{ position: "absolute", left: 0, top: 296, width: 1440, height: 584 }} />
      <div className="landing-beats-dimA" style={{ position: "absolute", left: 96, top: 330, width: 430, height: 248, background: "var(--landing-beats-wash-a)", mixBlendMode: "multiply", border: "1px solid var(--landing-beats-wash-a-line)", borderRadius: 6 }} />
      <div className="landing-beats-dimB" style={{ position: "absolute", left: 120, top: 604, width: 430, height: 248, background: "var(--landing-beats-wash-b)", mixBlendMode: "multiply", border: "1px solid var(--landing-beats-wash-b-line)", borderRadius: 6 }} />
      <div className="landing-beats-dimA landing-beats-mono" style={{ position: "absolute", left: 110, top: 338, fontSize: 9.5, color: C.graphite }}>Pricing model</div>
      <div className="landing-beats-dimB landing-beats-mono" style={{ position: "absolute", left: 134, top: 612, fontSize: 9.5, color: C.graphite }}>Fan engagement</div>

      <svg style={{ position: "absolute", left: 0, top: 0, width: 1440, height: 900, overflow: "visible" }} fill="none" strokeWidth="1">
        <g className="landing-beats-dimA">
          <path d="M312,412 C 390,412 500,470 566,470" stroke={C.connector} />
          <path d="M522,412 C 540,412 552,450 566,470" stroke={C.connector} />
          <path d="M412,508 C 470,508 520,470 566,470" stroke={C.connector} />
        </g>
        <path className="landing-beats-trunkA" d="M566,470 C 600,470 612,580 640,580" stroke={C.connector} />
        <g className="landing-beats-dimB">
          <path d="M336,686 C 380,686 560,740 590,740" stroke={C.connector} />
          <path d="M546,686 C 566,686 582,710 590,740" stroke={C.connector} />
          <path d="M436,782 C 500,782 560,745 590,740" stroke={C.connector} />
        </g>
        <path className="landing-beats-trunkB" d="M590,740 C 616,740 618,620 640,580" stroke={C.connector} />
        <path className="landing-beats-askline" d="M1072,580 L1000,580" stroke={C.node} />
        <circle cx="566" cy="470" r="3.5" fill={C.paper} stroke={C.node} />
        <circle className="landing-beats-dotA" cx="566" cy="470" r="1.6" fill={C.trunkA} />
        <circle cx="590" cy="740" r="3.5" fill={C.paper} stroke={C.node} />
        <circle className="landing-beats-dotB" cx="590" cy="740" r="1.6" fill={C.trunkB} />
      </svg>

      <div className="landing-beats-dimA">
        {CARDS_A.map((card) => (
          <PreviewCard key={card.title} card={card} />
        ))}
      </div>
      <div className="landing-beats-dimB">
        {CARDS_B.map((card) => (
          <PreviewCard key={card.title} card={card} />
        ))}
      </div>

      {FRAGS.map((frag, index) => (
        <div
          key={index}
          className={`landing-beats-frag ${frag.cls ?? ""}`}
          data-rest={frag.rest}
          style={{ offsetPath: `path('${frag.path}')`, animationDelay: frag.delay }}
        >
          {frag.text}
        </div>
      ))}

      <input className="landing-beats-slidein" type="radio" name="landing-beats-slide" id="landing-beats-s1" defaultChecked />
      <input className="landing-beats-slidein" type="radio" name="landing-beats-slide" id="landing-beats-s2" />
      <input className="landing-beats-slidein" type="radio" name="landing-beats-slide" id="landing-beats-s3" />
      <input className="landing-beats-slidein" type="radio" name="landing-beats-slide" id="landing-beats-s4" />
      <div className="landing-beats-deck" style={{ position: "absolute", left: 640, top: 460, width: 360, height: 240 }}>
        <div className="landing-beats-paper" style={{ position: "absolute", inset: 0, background: C.paper, border: `1px solid ${C.graphite}`, borderRadius: 3 }} />
        <div style={{ position: "absolute", left: 16, top: 12, right: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke={C.brand} strokeWidth="1.4" strokeLinecap="round">
            <path d="M4.4 2.6c.6 4.2 2.4 7.2 6.4 9.4-3.4 1.6-6.6.2-8-3" />
          </svg>
          <div style={{ fontSize: 11.5, fontWeight: 500 }}>Riverside Nine · marketing and engagement · v4</div>
        </div>
        <div style={{ position: "absolute", left: 16, top: 38, width: 328, height: 158 }}>
          {SLIDES.map((slide, index) => (
            <div
              key={slide.title}
              className={`landing-beats-slidein landing-beats-sl${index + 1}`}
              style={{ inset: 0, padding: "14px 16px", boxSizing: "border-box", border: `1px solid ${C.fragLine}`, borderRadius: 2 }}
            >
              <div className="landing-beats-mono" style={{ fontSize: 8, color: C.muted }}>Slide {index + 1}</div>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 19, marginTop: 8 }}>{slide.title}</div>
              <div style={{ fontSize: 10.5, color: C.graphite, marginTop: 8, lineHeight: 1.5 }}>{slide.body}</div>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", left: 16, bottom: 30, display: "flex", gap: 5 }}>
          {[1, 2, 3, 4].map((n) => (
            <label key={n} className={`landing-beats-pg landing-beats-t${n}`} htmlFor={`landing-beats-s${n}`} aria-label={`Slide ${n}`} />
          ))}
        </div>
      </div>
      <div className="landing-beats-callout landing-beats-paper" style={{ position: "absolute", left: 648, top: 414, height: 28, background: C.paper, border: `1px solid ${C.connector}`, borderRadius: 3, display: "flex", alignItems: "center", gap: 7, padding: "0 11px" }}>
        <span style={{ width: 6, height: 6, background: C.trunkA, display: "block" }} />
        <span className="landing-beats-mono" style={{ fontSize: 9.5, color: C.ink }}>Exact quote, three tools</span>
      </div>
      <div style={{ position: "absolute", left: 836, top: 716, fontFamily: "Caveat, cursive", fontSize: 16, color: C.graphite, transform: "rotate(-3deg)" }}>
        the deck the client sees
      </div>
      <svg style={{ position: "absolute", left: 826, top: 686 }} width="54" height="34" fill="none">
        <path d="M34,30 C 26,20 20,12 18,4" stroke={C.node} strokeWidth="1" />
        <path d="M18,4 l-4,8 M18,4 l5,7" stroke={C.node} strokeWidth="1" />
      </svg>

      <div className="landing-beats-paper" style={{ position: "absolute", left: 1072, top: 330, width: 312, height: 522, background: C.paper, border: `1px solid ${C.graphite}`, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: 46, borderBottom: `1px solid ${C.softRule}`, display: "flex", alignItems: "center", gap: 8, padding: "0 14px" }}>
          <AskMark className="landing-beats-askmark" />
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>Ask Lasso</div>
          <div style={{ flexGrow: 1 }} />
          <div className="landing-beats-mono" style={{ fontSize: 8.5, color: C.muted }}>Messages</div>
        </div>
        <div style={{ position: "absolute", left: 0, top: 46, right: 0, bottom: 44, overflow: "hidden" }}>
          <div className="landing-beats-strip" style={{ position: "absolute", left: 14, top: 12, width: 284 }}>
            {QUESTIONS.map((q) => (
              <div key={q.n} className={`landing-beats-q landing-beats-q${q.n}`} style={{ height: 260, position: "relative" }}>
                <div style={{ display: "flex", gap: 9 }}>
                  <span style={{ width: 22, height: 22, flex: "none", borderRadius: "50%", border: `1px solid ${C.hairline}`, background: C.avatar, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 600, color: C.graphite }}>P</span>
                  <div className="landing-beats-wake" style={{ fontSize: 12, lineHeight: 1.45 }}>{q.ask}</div>
                </div>
                <div className="landing-beats-think" style={{ position: "absolute", left: 31, top: q.thinkTop, width: 250 }}>
                  <div style={{ fontSize: 11, color: C.graphite, marginBottom: 8 }}>{q.reading}</div>
                  <div style={{ position: "relative" }}>
                    {q.steps.slice(1).map((_, i) => (
                      <div key={i} className="landing-beats-spine" style={{ top: 16 + i * 26, height: 26 }} />
                    ))}
                    {q.steps.map((step, i) => (
                      <StepRow key={step.label} g={step.g} label={step.label} className={`landing-beats-st ${i > 0 ? `landing-beats-d${i}` : ""}`} />
                    ))}
                  </div>
                </div>
                <div style={{ position: "absolute", left: 0, top: 132, width: 284, display: "flex", gap: 9 }}>
                  <AskMark />
                  <div style={{ position: "relative", paddingLeft: 11, minWidth: 0 }}>
                    <div className="landing-beats-ar" style={{ position: "absolute", left: 0, top: 0, width: 2, height: q.ruleHeight, background: C.lime }} />
                    <div className="landing-beats-at" style={{ fontSize: 12, lineHeight: 1.45 }}>{q.answer}</div>
                    <div className="landing-beats-au" style={{ marginTop: 12, borderTop: `1px solid ${C.faintRule}`, paddingTop: 8 }}>
                      <ClosedAuditLine count={q.count} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", left: 14, bottom: 14, width: 284, fontSize: 10.5, lineHeight: 1.4, color: C.muted }}>
          A shared board is read only. Its link closes after 48 hours.
        </div>
      </div>
    </div>
  );
}

export function HeroMotion() {
  return (
    <ScaledStage width={1440} height={584} label="Conversations from Claude, Gemini and ChatGPT feeding one client deck, with Ask Lasso tracing a figure back to its source">
      <Artboard />
    </ScaledStage>
  );
}
