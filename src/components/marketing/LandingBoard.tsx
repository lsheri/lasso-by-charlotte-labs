import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import claudeLogo from "@/assets/claude-logo.png.asset.json";
import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { LandingParticlePhrase } from "@/components/marketing/LandingParticlePhrase";
import { FocusSection } from "@/components/marketing/FocusSection";
import { LassoThinkingMark } from "@/components/reflect/LassoThinkingMark";
import { Button } from "@/components/ui/button";
import { VendorMark } from "@/components/work/SourceMark";
import { openDemoBoardFn } from "@/lib/demo.functions";
import type { DemoPreset } from "@/lib/demo-presets-shared";
import { submitPilotRequestFn } from "@/lib/pilot-request.functions";
import { recordAnonymousEventFn } from "@/lib/telemetry.functions";
import type { SharedBoardDto, SharedSeedWork } from "@/lib/board-share-shared";
import { keptContentLabel } from "@/lib/work-open";

export const LANDING_BOARD_STEPS = [
  { key: "problem", label: "Problem", headline: "Your firm's thinking went invisible.", line: "The work is scattered across tools, tabs, and drafts." },
  { key: "canvas", label: "Canvas", headline: "All your AI research and conversations, on one infinite canvas.", line: "Today your team's thinking is spread across four AI tools and a hundred tabs." },
  { key: "workstreams", label: "Workstreams", headline: "Grouped into workstreams, the way your team actually splits the work.", line: "The shape of the engagement becomes visible without changing the source material." },
  { key: "deliverable", label: "Deliverable", headline: "Every workstream wired to the deliverable it fed.", line: "The finished deck stays connected to the work behind it." },
  { key: "circle", label: "Circle", headline: "A number worth asking about.", line: "Where did the $1.4M on slide 3 come from?" },
  { key: "ask", label: "Ask", headline: "Every answer shows what it read.", line: "The saved response opens with its source trail already visible." },
  { key: "the-turn", label: "The turn", headline: "Back to the exact turn where it was decided.", line: "The answer points to the source conversation, not a reconstructed summary." },
  { key: "still-open", label: "Still open", headline: "And what's still open, pinned where it came from.", line: "Questions stay beside the work that raised them." },
  { key: "share", label: "Share", headline: "Share the deliverable, not the drafts.", line: "A read-only view closes in 48 hours and opens only what you chose." },
  { key: "try-it", label: "Try it", headline: "Your turn.", line: "Open the invented workspace and inspect the board yourself." },
] as const;

type StepKey = (typeof LANDING_BOARD_STEPS)[number]["key"];
type StoryInput = "scroll" | "jump";

const TOOL_BADGES = [
  { key: "claude", label: "Claude", logo: claudeLogo.url },
  { key: "chatgpt", label: "ChatGPT", logo: null },
  { key: "gemini", label: "Gemini", logo: null },
  { key: "googledrive", label: "Drive", logo: null },
  { key: "gmail", label: "Gmail", logo: null },
] as const;

const FALLBACK_SLIDES = ["Partnership model", "Board structure", "$1.4M year-two net benefit", "Comparable health alliances", "Chair terms", "FY27 recommendation"];

function event(viewId: string, eventType: "landing.viewed" | "landing.story_section_viewed" | "landing.section_jumped" | "landing.pilot_cta_clicked" | "landing.pilot_requested" | "landing.usecase_played", dims: Record<string, string>) {
  void recordAnonymousEventFn({ data: { event_type: eventType, view_id: viewId, dims } }).catch(() => undefined);
}

function toolKey(item: SharedSeedWork): string {
  return (item.source_vendor ?? item.source_meta?.vendor ?? item.source ?? "document").toLowerCase().replace(/^connector:/, "");
}

function ToolIdentity({ tool, compact = false }: { tool: string; compact?: boolean }) {
  const known = TOOL_BADGES.find((entry) => tool.includes(entry.key));
  const label = known?.label ?? (tool === "document" || tool === "upload" ? "Document" : tool);
  return (
    <span className="lb-tool-identity">
      {known?.logo ? <img src={known.logo} alt="" aria-hidden="true" /> : null}
      <span>{compact ? label : label.toUpperCase()}</span>
    </span>
  );
}

function BoardCard({ item, index, step, pin, read }: { item: SharedSeedWork; index: number; step: number; pin: number | undefined; read: boolean }) {
  const turnCount = item.type === "ai_thread" ? undefined : null;
  return (
    <article className="lb-board-card" data-arrived={step >= 1} style={{ "--lb-card-index": index } as CSSProperties}>
      <VendorMark item={item} />
      <strong>{item.title}</strong>
      <small>{keptContentLabel(item, turnCount)}</small>
      {pin ? <span className="lb-pin" aria-label={`Source ${pin}`}>{pin}</span> : read ? <span className="lb-read-dot" aria-label="Read for this response" /> : null}
    </article>
  );
}

function SavedAnswer({ preset, title }: { preset: DemoPreset | undefined; title: string }) {
  return (
    <aside className="lb-answer-sheet" aria-label={title}>
      <p className="lb-micro">ASK LASSO</p>
      <h3>{preset?.question ?? title}</h3>
      <div className="lb-answer-copy">{preset?.answer || "This saved demo answer is not available right now."}</div>
      {preset?.manifest ? (
        <div className="lb-trail">
          <strong>Read for this response</strong>
          {preset.manifest.items.map((item, index) => <span key={`${item.id}-${index}`}><b>{index + 1}</b>{item.title}{item.detail ? ` · ${item.detail}` : ""}</span>)}
        </div>
      ) : null}
    </aside>
  );
}

function ExactTurn({ board, preset }: { board: SharedBoardDto; preset: DemoPreset | undefined }) {
  const ref = preset?.turnRefs.find((entry) => entry.turn_no === 5) ?? preset?.turnRefs[0];
  const item = ref ? board.seed.work.find((entry) => entry.id === ref.work_item_id) : undefined;
  const turn = ref ? board.turns[ref.work_item_id]?.find((entry) => entry.turn_no === ref.turn_no) : undefined;
  return (
    <aside className="lb-turn-reader" aria-label="Exact turn reader">
      <header><div><ToolIdentity tool={item ? toolKey(item) : "document"} /><h3>{item?.title ?? "Source conversation"}</h3></div><span>READ ONLY</span></header>
      <div className="lb-turn-body">
        <p className="lb-turn-muted">Earlier turns are kept above.</p>
        <article className="lb-highlight-turn"><span>TURN {turn?.turn_no ?? ref?.turn_no ?? 5}</span><p>{turn?.content ?? preset?.answer ?? "The saved source turn is not available right now."}</p></article>
      </div>
    </aside>
  );
}

function StoryBoard({ board, presets, step }: { board: SharedBoardDto; presets: DemoPreset[]; step: number }) {
  const deckItem = board.seed.work.find((item) => /board deck/i.test(item.title));
  const items = board.seed.work.filter((item) => item.id !== deckItem?.id).slice(0, 9);
  const slides = useMemo(() => {
    const pages = deckItem ? board.filePreviews[deckItem.id]?.pages : undefined;
    return Array.from({ length: 6 }, (_, index) => pages?.[index]?.title || pages?.[index]?.lines[0] || FALLBACK_SLIDES[index]);
  }, [board, deckItem]);
  const first = presets.find((preset) => preset.position === 1);
  const second = presets.find((preset) => preset.position === 2);
  const fourth = presets.find((preset) => preset.position === 4);
  const trailNumbers = new Map(first?.manifest?.items.map((item, index) => [item.id, index + 1]) ?? []);
  const citedIds = new Set(first?.turnRefs.map((ref) => ref.work_item_id) ?? []);
  const readIds = new Set(first?.manifest?.items.map((item) => item.id) ?? []);
  const visibleTasks = board.seed.tasks.filter((task) => !/board deck/i.test(task.name)).slice(0, 2);
  return (
    <div className="lb-stage-window" data-step={step + 1} data-testid="landing-board-stage">
      <div className="lb-board-layer">
        <div className="lb-dot-grid" />
        <div className="lb-tool-dock" aria-label="Sources">
          {TOOL_BADGES.map((tool) => <div key={tool.key}>{tool.logo ? <img src={tool.logo} alt="" aria-hidden="true" /> : null}<span>{tool.label}</span></div>)}
        </div>
        <div className="lb-frames">
          {visibleTasks.map((task, index) => <section key={task.id} style={{ "--lb-frame-index": index } as CSSProperties}><h3>{task.name}</h3><p>{task.detail}</p></section>)}
        </div>
        <div className="lb-cards">
          {items.map((item, index) => <BoardCard key={item.id} item={item} index={index} step={step} pin={step >= 5 && citedIds.has(item.id) ? trailNumbers.get(item.id) : undefined} read={step >= 5 && readIds.has(item.id)} />)}
        </div>
        <svg className="lb-connectors" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
          <path d="M260 230 C470 220 570 280 735 350" /><path d="M260 390 C470 390 590 380 735 350" /><path d="M540 485 C620 470 680 410 735 350" />
        </svg>
        <article className="lb-deck">
          <header><span>DELIVERABLE</span><strong>{deckItem?.title ?? "FY27 board deck v3"}</strong></header>
          <div>{slides.map((slide, index) => <section key={`${slide}-${index}`} data-slide={index + 1}><small>{index + 1}</small><p>{slide}</p>{index === 2 ? <span className="lb-number">$1.4M</span> : null}</section>)}</div>
        </article>
        <div className="lb-circle-question"><span /><p>Where did the $1.4M on slide 3 come from?</p></div>
        {step === 5 ? <SavedAnswer preset={first} title="Where did the $1.4M on slide 3 come from?" /> : null}
        {step === 6 ? <><SavedAnswer preset={second} title="Find the conversation where the board settled it." /><ExactTurn board={board} preset={second} /></> : null}
        {step === 7 ? <><SavedAnswer preset={fourth} title="What is still open?" /><div className="lb-open-notes"><p>{fourth?.answer.split(".")[0] || "Confirm the final assumption."}</p><p>{fourth?.answer.split(".")[1] || "Settle the remaining board choice."}</p></div></> : null}
        {step === 8 ? <div className="lb-share-dialog"><p className="lb-micro">READ ONLY</p><h3>Share this board</h3><p>They open the deliverable, source cards, and the conversations behind them.</p><p>They do not open private drafts or anything outside this board.</p><strong>Closes in 48 hours</strong><small>In the demo this is shown, not issued.</small></div> : null}
      </div>
    </div>
  );
}

function LandingBoardHeader({ active, onJump, onPilot }: { active: StepKey; onJump: (key: StepKey) => void; onPilot: () => void }) {
  return (
    <header className="lb-header">
      <div className="lb-header-main">
        <Link to="/" className="lb-brand"><LassoLoopMark /> <span>LASSO</span></Link>
        <nav className="lb-step-nav" aria-label="Story sections">
          {LANDING_BOARD_STEPS.map((item) => <Button key={item.key} size="sm" variant="ghost" aria-current={active === item.key ? "step" : undefined} onClick={() => onJump(item.key)}>{item.label}</Button>)}
        </nav>
        <Button asChild size="sm"><a href="#pilot" onClick={onPilot}>Book a pilot</a></Button>
      </div>
    </header>
  );
}

function LandingBoardContinuation({ viewId, onPilot }: { viewId: string; onPilot: (placement: string) => void }) {
  const submitPilot = useServerFn(submitPilotRequestFn);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function submit(eventValue: FormEvent<HTMLFormElement>) {
    eventValue.preventDefault();
    setState("sending");
    const form = eventValue.currentTarget;
    const controls = form.elements as typeof form.elements & { name: HTMLInputElement; firm: HTMLInputElement; email: HTMLInputElement; teamSize: HTMLSelectElement; note: HTMLTextAreaElement; website: HTMLInputElement };
    const teamSize = controls.teamSize.value as "1-5" | "6-15" | "16-40" | "40+";
    try {
      await submitPilot({ data: { name: controls.name.value, firm: controls.firm.value, email: controls.email.value, team_size: teamSize, note: controls.note.value || undefined, website: controls.website.value } });
      event(viewId, "landing.pilot_requested", { team_size: teamSize });
      setState("sent");
    } catch { setState("error"); }
  }
  return (
    <div className="landing-next lb-continuation">
      <section className="landing-usecases mx-auto max-w-[1200px] px-4 md:px-6" aria-label="What consultants use it for">
        <div className="landing-section-head"><p className="micro-label">HOW IT WORKS</p><h2 className="pencil-title">Deliverables you can defend to a client, a partner, or a board.</h2></div>
        <div className="landing-usecase-grid">
          {["Push work in with one sentence.", "Every AI conversation, on the record.", "Every number has a source."].map((title, index) => <article className="landing-usecase" key={title}><div className="landing-usecase-media lb-usecase-art"><LassoThinkingMark kind={index === 2 ? "trace" : "signature"} size={92} /></div><div className="landing-usecase-copy"><h3>{title}</h3><p>{["Bring work from your AI tools into one shared place.", "Keep the conversations that shaped the engagement.", "Open the source behind a figure or claim."][index]}</p></div></article>)}
        </div>
      </section>
      <section className="landing-close mx-auto max-w-4xl px-6 md:px-10" data-resolved="true"><h2 className="landing-close-line1 landing-close-wordmark">Every claim, traced to the work behind it.</h2><p className="landing-close-line2"><LandingParticlePhrase text="The judgement, thinking, work... *Visible*" /></p><div className="mt-10"><Button asChild><a href="#pilot" onClick={() => onPilot("close")}>Book a pilot</a></Button></div></section>
      <div className="mx-auto max-w-3xl px-6 pb-24 md:px-10"><div id="pilot"><FocusSection className="mt-20 border-t border-rule pt-10"><p className="micro-label">PILOT</p><h2 className="pencil-title mt-4">Run it on one engagement.</h2>{state === "sent" ? <p className="mt-8 border-l-2 border-green pl-4">Thanks. Liam will be in touch within a day.</p> : <form className="landing-next-pilot-form mt-8 grid gap-5" onSubmit={submit}><label className="sr-only" aria-hidden="true"><span>Website</span><input name="website" tabIndex={-1} autoComplete="off" /></label><label><span>Name</span><input name="name" required /></label><label><span>Firm</span><input name="firm" required /></label><label><span>Work email</span><input name="email" type="email" required /></label><label><span>Team size</span><select name="teamSize" required defaultValue=""><option value="" disabled>Select team size</option><option value="1-5">1 to 5</option><option value="6-15">6 to 15</option><option value="16-40">16 to 40</option><option value="40+">40+</option></select></label><label><span>Anything we should know</span><textarea name="note" rows={4} /></label><div><Button type="submit" disabled={state === "sending"} onClick={() => onPilot("form")}>{state === "sending" ? "Sending…" : "Book a pilot"}</Button></div>{state === "error" ? <p role="alert">That didn't go through. Email liam@charlotte-labs.com and we'll pick it up.</p> : null}</form>}</FocusSection></div></div>
      <footer className="border-t border-rule"><div className="mx-auto flex max-w-3xl flex-wrap gap-4 px-6 py-8 font-mono text-[11px] text-muted-foreground"><span>Charlotte Labs</span><a href="https://charlotte-labs.com">charlotte-labs.com</a><a href="mailto:liam@charlotte-labs.com">liam@charlotte-labs.com</a><Link to="/trust">Trust &amp; data</Link></div></footer>
    </div>
  );
}

export function LandingBoard() {
  const open = useServerFn(openDemoBoardFn);
  const query = useQuery({ queryKey: ["landing-board", "YSM-01"], queryFn: () => open({ data: { code: "YSM-01" } }), staleTime: 60_000, retry: false });
  const viewId = useRef(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const [active, setActive] = useState(0);
  const input = useRef<StoryInput>("scroll");
  const jumpTarget = useRef<number | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => { event(viewId.current, "landing.viewed", { variant: "b2b", surface: "landing-board" }); }, []);
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-lb-step]"));
    const observer = new IntersectionObserver((entries) => {
      if (jumpTarget.current !== null) return;
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const index = Number((visible.target as HTMLElement).dataset["lbStep"] ?? 0);
      setActive(index);
      const key = LANDING_BOARD_STEPS[index]?.key;
      if (key && !seen.current.has(`${key}:${input.current}`)) {
        seen.current.add(`${key}:${input.current}`);
        event(viewId.current, "landing.story_section_viewed", { section: key, input_mode: input.current });
      }
      input.current = "scroll";
    }, { rootMargin: "-42% 0px -42% 0px", threshold: [0, 0.01, 0.5] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  function jump(key: StepKey) {
    const index = LANDING_BOARD_STEPS.findIndex((step) => step.key === key);
    if (index < 0) return;
    input.current = "jump";
    jumpTarget.current = index;
    setActive(index);
    event(viewId.current, "landing.section_jumped", { section: key });
    if (!seen.current.has(`${key}:jump`)) {
      seen.current.add(`${key}:jump`);
      event(viewId.current, "landing.story_section_viewed", { section: key, input_mode: "jump" });
    }
    document.getElementById(`lb-${key}`)?.scrollIntoView({ behavior: "auto", block: "start" });
    window.setTimeout(() => {
      jumpTarget.current = null;
      input.current = "scroll";
    }, 80);
  }
  function pilot(placement: string) { event(viewId.current, "landing.pilot_cta_clicked", { placement }); }
  const result = query.data;
  return (
    <div className="landing-board-page">
      <LandingBoardHeader active={LANDING_BOARD_STEPS[active]?.key ?? "problem"} onJump={jump} onPilot={() => pilot("header")} />
      <main className="lb-story">
        <div className="lb-sticky-stage">
          {result?.status === "open" && "board" in result ? <StoryBoard board={result.board} presets={result.presets} step={active} /> : <div className="lb-stage-window lb-loading">{query.isPending ? "Opening the demo board." : "The demo board is not available right now."}</div>}
        </div>
        <div className="lb-scroll-sections">
          {LANDING_BOARD_STEPS.map((step, index) => (
            <section id={`lb-${step.key}`} data-lb-step={index} key={step.key} className="lb-scroll-step">
              {index === 0 ? <div className="lb-hero-copy"><LassoThinkingMark kind="signature" size={150} /><div><h1>Your firm bought AI. <LandingParticlePhrase text="The human judgment, process, and thinking" /> in your team's work went invisible.</h1><h2>Lasso is the reasoning and judgment layer for AI-assisted consulting. It connects the work across tools to the client deliverable and keeps the decisions your team made, so they can show where a claim came from and why it stayed.</h2><div><Button onClick={() => jump("canvas")}>Watch it work</Button><Button asChild variant="outline"><a href="#pilot" onClick={() => pilot("hero")}>Book a pilot</a></Button></div></div></div> : null}
               {index === 0 ? null : <article className="lb-caption"><span>{String(index + 1).padStart(2, "0")} · {step.label}</span><h2>{step.headline}</h2><p>{step.line}</p>{index === 9 ? <div><Button asChild><Link to="/demo/$code" params={{ code: "YSM-01" }}>Open the board yourself</Link></Button><Button asChild variant="outline"><a href="#pilot" onClick={() => pilot("try_it")}>Book a pilot</a></Button></div> : null}</article>}
            </section>
          ))}
        </div>
      </main>
      <LandingBoardContinuation viewId={viewId.current} onPilot={pilot} />
    </div>
  );
}