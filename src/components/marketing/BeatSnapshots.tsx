import { ClosedAuditLine, PreviewCard, type PreviewCardData, ScaledStage, StepRow } from "@/components/marketing/HeroMotion";

const W = 560;
const H = 320;

const ink = "var(--landing-beats-ink)";
const graphite = "var(--landing-beats-graphite)";
const muted = "var(--landing-beats-muted)";
const paper = "var(--landing-beats-paper)";
const connector = "var(--landing-beats-connector)";
const node = "var(--landing-beats-node)";
const fragLine = "var(--landing-beats-frag-line)";

const sheet = {
  position: "absolute" as const,
  background: paper,
  border: `1px solid ${graphite}`,
  borderRadius: 3,
};

const VENDOR_CARDS: PreviewCardData[] = [
  { vendor: "claude", tool: "Claude", when: "14 Aug", title: "Rate card v3 walkthrough", summary: "Kept 18% across all segments.", url: "claude.ai/chat/rate-card-v3", left: 24, top: 18 },
  { vendor: "chatgpt", tool: "ChatGPT", when: "21 Aug", title: "Uplift maths, second pass", summary: "Carried the 18% through unchanged.", url: "chatgpt.com/c/7ad0-uplift", left: 24, top: 142 },
  { vendor: "gemini", tool: "Gemini", when: "9 Aug", title: "Discount floor by segment", summary: "Holds at 12% for the mid tier.", url: "gemini.google.com/app/8f21c", left: 150, top: 80 },
  { vendor: "granola", tool: "Granola", when: "22 Aug", title: "Pricing call with the client", summary: "Client asked where the uplift came from.", url: "granola notes", left: 150, top: 204 },
];

export function BeatToolsSnapshot() {
  return (
    <ScaledStage width={W} height={H} className="landing-beats-dots" label="Conversations from Claude, ChatGPT, Gemini and Granola joining one lane">
      {VENDOR_CARDS.map((card) => (
        <PreviewCard key={card.tool} card={card} style={{ width: 170, height: 100 }} />
      ))}
      <svg style={{ position: "absolute", inset: 0 }} width={W} height={H} fill="none" strokeWidth="1">
        {[
          "M194,68 C 300,68 330,160 400,160",
          "M194,192 C 300,192 330,160 400,160",
          "M320,130 C 360,130 370,160 400,160",
          "M320,254 C 360,254 370,160 400,160",
        ].map((d) => (
          <path key={d} className="landing-beats-b1-draw" pathLength={1} d={d} stroke={node} />
        ))}
        <circle cx="400" cy="160" r="3.5" fill={paper} stroke={node} />
      </svg>
      <div style={{ ...sheet, left: 410, top: 60, width: 130, height: 200, background: "var(--landing-beats-wash-a)", borderColor: "var(--landing-beats-wash-a-line)", borderRadius: 6 }}>
        <div className="landing-beats-mono" style={{ fontSize: 9.5, color: graphite, padding: "8px 10px" }}>Pricing model</div>
        {["Claude", "ChatGPT", "Gemini", "Granola"].map((tool, i) => (
          <div key={tool} style={{ margin: "0 10px 8px", height: 28, background: paper, border: `1px solid ${connector}`, borderRadius: 3, fontSize: 10.5, display: "flex", alignItems: "center", padding: "0 8px", opacity: 1 - i * 0.08 }}>
            {tool}
          </div>
        ))}
      </div>
    </ScaledStage>
  );
}

export function BeatClaimSnapshot() {
  return (
    <ScaledStage width={W} height={H} className="landing-beats-dots" label="A line in a deliverable, underlined, with the source turn opening beside it">
      <div className="landing-beats-paper" style={{ ...sheet, left: 24, top: 30, width: 260, height: 260, padding: "16px 18px", boxSizing: "border-box" }}>
        <div className="landing-beats-mono" style={{ fontSize: 8, color: muted }}>Slide 3</div>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 19, marginTop: 8 }}>Ticket bundles</div>
        <div style={{ fontSize: 11, color: graphite, marginTop: 10, lineHeight: 1.6 }}>
          Recommended uplift of{" "}
          <span style={{ position: "relative", display: "inline-block", color: ink, fontWeight: 500 }}>
            18% across all segments
            <span className="landing-beats-b2-line" style={{ position: "absolute", left: 0, bottom: -1, width: "100%", height: 1, background: ink }} />
          </span>
          , carried from the model.
        </div>
        {[180, 150, 200, 120].map((w, i) => (
          <div key={i} style={{ marginTop: 12, width: w, height: 5, background: fragLine, borderRadius: 1 }} />
        ))}
      </div>
      <div className="landing-beats-b2-trail landing-beats-paper" style={{ ...sheet, left: 306, top: 60, width: 230, height: 200, padding: "14px 16px", boxSizing: "border-box" }}>
        <div className="landing-beats-mono" style={{ fontSize: 8.5, color: muted }}>Source turn</div>
        <div style={{ marginTop: 10, position: "relative" }}>
          <div className="landing-beats-spine" style={{ top: 16, height: 26 }} />
          <div className="landing-beats-spine" style={{ top: 42, height: 26 }} />
          <StepRow g="doc" label="Slide 3, ticket bundles" />
          <StepRow g="chat" label="Claude, turn 14" />
          <StepRow g="lens" label="Rate card v3, 14 Aug" />
        </div>
        <div style={{ marginTop: 14, fontSize: 11, lineHeight: 1.5, color: ink, borderLeft: `2px solid ${connector}`, paddingLeft: 9 }}>
          &ldquo;Keep 18% across all segments.&rdquo;
        </div>
      </div>
    </ScaledStage>
  );
}

const READ_ROWS = ["Rate card v3 walkthrough", "Uplift maths, second pass", "Discount floor by segment", "Pricing call with the client", "Ticket bundles deck", "The brief"];
const NOT_READ_ROWS = [
  { title: "Fan vote thread", reason: "not part of this engagement" },
  { title: "Venue notes", reason: "not selected for this question" },
  { title: "Season recap", reason: "over the context limit, the middle of those items was left out" },
];

export function BeatNotReadSnapshot() {
  return (
    <ScaledStage width={W} height={H} className="landing-beats-dots" label="Read what went into this response, opening into what was read and what was not read">
      <div className="landing-beats-paper" style={{ ...sheet, left: 40, top: 16, width: 480, height: 288, padding: "14px 18px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, height: 30 }}>
          <svg className="landing-beats-b3-caret" width="11" height="11" viewBox="0 0 11 11" fill="none" stroke={graphite} strokeWidth="1.5" strokeLinecap="round">
            <path d="M4 2l4 3.5L4 9" />
          </svg>
          <span style={{ fontSize: 13, color: ink }}>Read what went into this response</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: muted }}>9</span>
        </div>
        <div className="landing-beats-b3-open" style={{ marginTop: 6 }}>
          <div className="landing-beats-mono" style={{ fontSize: 8.5, color: muted, marginBottom: 4 }}>Read</div>
          {READ_ROWS.map((title) => (
            <div key={title} style={{ fontSize: 12, height: 20, display: "flex", alignItems: "center", gap: 8, color: ink }}>
              <span style={{ width: 8, height: 1, background: graphite, display: "block" }} />
              {title}
            </div>
          ))}
          <div className="landing-beats-mono" style={{ fontSize: 8.5, color: muted, margin: "10px 0 4px" }}>Not read</div>
          {NOT_READ_ROWS.map((row) => (
            <div key={row.title} className="landing-beats-notread" style={{ fontSize: 12, height: 20, display: "flex", alignItems: "center", gap: 8, color: ink, whiteSpace: "nowrap" }}>
              <span style={{ width: 4, height: 1, background: graphite, display: "block" }} />
              {row.title}
              <span style={{ color: muted }}> - {row.reason}</span>
            </div>
          ))}
        </div>
      </div>
    </ScaledStage>
  );
}

export function BeatRefuseSnapshot() {
  return (
    <ScaledStage width={W} height={H} className="landing-beats-dots" label="A workstream note that cannot be linked as a source">
      <div className="landing-beats-paper" style={{ ...sheet, left: 30, top: 70, width: 200, height: 170, padding: "12px 14px", boxSizing: "border-box" }}>
        <div className="landing-beats-mono" style={{ fontSize: 8, color: muted }}>Workstream note</div>
        <div style={{ fontSize: 12, fontWeight: 500, marginTop: 8 }}>Pricing, where we landed</div>
        {[150, 120, 160, 100].map((w, i) => (
          <div key={i} style={{ marginTop: 11, width: w, height: 5, background: fragLine, borderRadius: 1 }} />
        ))}
      </div>
      <div className="landing-beats-paper" style={{ ...sheet, left: 340, top: 70, width: 190, height: 170, padding: "12px 14px", boxSizing: "border-box" }}>
        <div className="landing-beats-mono" style={{ fontSize: 8, color: muted }}>Sources for slide 3</div>
        <div style={{ marginTop: 10 }}>
          <StepRow g="chat" label="Claude, turn 14" />
          <StepRow g="doc" label="Rate card v3" />
        </div>
      </div>
      <svg style={{ position: "absolute", inset: 0 }} width={W} height={H} fill="none">
        <path className="landing-beats-b4-reach" pathLength={1} d="M230,155 C 262,155 280,155 300,155" stroke={node} strokeWidth="1" strokeDasharray="1" />
        <path className="landing-beats-b4-refuse" d="M304,147 L320,163 M320,147 L304,163" stroke={graphite} strokeWidth="1.4" />
      </svg>
      <div className="landing-beats-b4-refuse" style={{ position: "absolute", left: 250, top: 176, fontFamily: "Caveat, cursive", fontSize: 16, color: graphite, transform: "rotate(-3deg)" }}>
        never a source
      </div>
    </ScaledStage>
  );
}

export function BeatReviewerSnapshot() {
  return (
    <ScaledStage width={W} height={H} className="landing-beats-dots" label="A shared board, read only, with a link that closes after 48 hours">
      <div style={{ ...sheet, left: 24, top: 30, width: 300, height: 260, background: "var(--landing-beats-wash-a)", borderColor: "var(--landing-beats-wash-a-line)", borderRadius: 6 }}>
        <div className="landing-beats-mono" style={{ fontSize: 9.5, color: graphite, padding: "10px 12px" }}>Your board</div>
        {["Rate card v3 walkthrough", "Uplift maths, second pass", "Discount floor by segment"].map((title) => (
          <div key={title} className="landing-beats-paper" style={{ margin: "0 12px 10px", height: 44, background: paper, border: `1px solid ${graphite}`, borderRadius: 3, fontSize: 11, display: "flex", alignItems: "center", padding: "0 10px" }}>
            {title}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 340, top: 30, width: 1, height: 260, borderLeft: `1px dashed ${node}` }} />
      <div className="landing-beats-paper" style={{ ...sheet, left: 356, top: 60, width: 180, height: 200, padding: "12px 14px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 500 }}>Shared link</span>
        </div>
        <div className="landing-beats-mono" style={{ fontSize: 8.5, color: muted, marginTop: 12 }}>Read only</div>
        <div style={{ fontSize: 11, lineHeight: 1.5, marginTop: 6, color: ink }}>No edits, no menus, nothing that writes.</div>
        <div className="landing-beats-mono" style={{ fontSize: 8.5, color: muted, marginTop: 14 }}>Expires in 48 hours</div>
        <div style={{ marginTop: 16 }}>
          <ClosedAuditLine count={3} />
        </div>
      </div>
    </ScaledStage>
  );
}
