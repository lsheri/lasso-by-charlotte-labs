import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { type FormEvent, useEffect, useRef, useState } from "react";

import claudePushPoster from "@/assets/landing/lasso-claude-push-poster.png.asset.json";
import claudePushVideo from "@/assets/landing/lasso-claude-push.mp4.asset.json";
import connectorPoster from "@/assets/landing/lasso-connector-poster.png.asset.json";
import connectorVideo from "@/assets/landing/lasso-connector.mp4.asset.json";
import pastWorkLibrary from "@/assets/past-work-library.png.asset.json";
import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { ClipPlayer } from "@/components/marketing/ClipPlayer";
import { FocusSection } from "@/components/marketing/FocusSection";
import { PrivacyToggleDemo } from "@/components/marketing/PrivacyToggleDemo";
import { VendorLabel } from "@/components/marketing/VendorMark";
import { Button } from "@/components/ui/button";
import { startSessionReplay, stopSessionReplay } from "@/lib/posthog-client";
import { submitPilotRequestFn } from "@/lib/pilot-request.functions";
import { recordAnonymousEventFn } from "@/lib/telemetry.functions";

type ClipSlotProps = {
  id: string;
  src?: string;
  poster?: string;
  label: string;
  width?: number;
  height?: number;
};

// Fallback variant for the landing hero.
export const HERO_H1_FALLBACK = "Your firm bought AI. Now nobody can say where a number came from.";

function ClipSlot({ id, src, poster, label, width = 1440, height = 900 }: ClipSlotProps) {
  if (src && poster) {
    return (
      <ClipPlayer
        src={src}
        poster={poster}
        width={width}
        height={height}
        aspect="16 / 9"
        label={label}
        playback="hold"
      />
    );
  }

  return (
    <div
      id={`clip-slot-${id}`}
      className="landing-next-slot flex w-full items-center justify-center rounded-[var(--radius)] border border-dashed border-rule bg-card"
      style={{ aspectRatio: "16 / 9" }}
      aria-label={`${label}. Clip coming soon.`}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
        {id.replaceAll("-", " ")}
      </span>
    </div>
  );
}

export function B2BLanding({ surface }: { surface: "home" | "landing-next" }) {
  const viewId = useRef<string>(crypto.randomUUID());
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const submitPilot = useServerFn(submitPilotRequestFn);

  useEffect(() => {
    void recordAnonymousEventFn({
      data: {
        event_type: "landing.viewed",
        view_id: viewId.current,
        dims: { variant: "b2b", surface },
      },
    }).catch(() => {
      /* This signal must never surface to the visitor. */
    });
  }, []);

  useEffect(() => {
    stopSessionReplay();
    return () => startSessionReplay();
  }, []);

  function notePilotClick(location: "hero" | "pilot") {
    void recordAnonymousEventFn({
      data: {
        event_type: "landing.pilot_cta_clicked",
        view_id: viewId.current,
        dims: { location },
      },
    }).catch(() => {
      /* This signal must never surface to the visitor. */
    });
  }

  function noteSeeItWorkClick() {
    void recordAnonymousEventFn({
      data: {
        event_type: "landing.see_it_work_clicked",
        view_id: viewId.current,
        dims: { location: "hero" },
      },
    }).catch(() => {
      /* This signal must never surface to the visitor. */
    });
  }

  async function submitPilotRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    notePilotClick("pilot");
    setSubmitting(true);
    setSubmitError(false);
    const form = event.currentTarget;
    const controls = form.elements as typeof form.elements & {
      name: HTMLInputElement;
      firm: HTMLInputElement;
      email: HTMLInputElement;
      teamSize: HTMLSelectElement;
      note: HTMLTextAreaElement;
      website: HTMLInputElement;
    };
    const teamSize = controls.teamSize.value as "1-5" | "6-15" | "16-40" | "40+";
    try {
      await submitPilot({
        data: {
          name: controls.name.value,
          firm: controls.firm.value,
          email: controls.email.value,
          team_size: teamSize,
          note: controls.note.value || undefined,
          website: controls.website.value,
        },
      });
      void recordAnonymousEventFn({
        data: {
          event_type: "landing.pilot_requested",
          view_id: viewId.current,
          dims: { team_size: teamSize },
        },
      }).catch(() => {
        /* This signal must never surface to the visitor. */
      });
      setSubmitted(true);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="landing-next min-h-screen overflow-x-clip bg-background">
      <div className="landing-next-loop-small pointer-events-none fixed" aria-hidden="true">
        <LassoLoopMark className="h-full w-full text-green" drawWithScroll />
      </div>

      <div className="relative z-10">
        <PublicHeader current="/" />

        <main className="pb-24 pt-16 md:pt-20">
          <div className="mx-auto max-w-3xl px-6 md:px-10">
            <section className="landing-next-hero">
              <h1 className="pencil-title mt-5 text-foreground">
                Your firm bought AI. The human judgment in your team's work went invisible.
              </h1>
              <h2 className="mt-6 max-w-2xl text-[26px] leading-relaxed text-muted-foreground">
                Lasso traces every fact in a deliverable to its source and keeps the decisions your
                team made alongside it. Work you can defend to a client, a partner, or a board.
              </h2>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Button asChild>
                  <a href="#pilot" onClick={() => notePilotClick("hero")}>
                    Book a pilot
                  </a>
                </Button>
                <a
                  href="#how-it-works"
                  onClick={noteSeeItWorkClick}
                  className="story-link text-sm text-foreground transition-colors hover:text-muted-foreground"
                >
                  See it work ↓
                </a>
              </div>
              <Link
                to="/auth"
                search={{ intent: "personal" }}
                className="mt-5 inline-block text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
              >
                Start your own record
              </Link>
            </section>

            <div id="how-it-works">
            <FocusSection className="mt-24">
              <h2 className="pencil-title">
                Where the work actually happens now.
              </h2>
              <p className="micro-label mt-8">Clips show sample data.</p>
              <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-12 sm:gap-x-5 sm:gap-y-14">
                <div className="sm:-rotate-[0.6deg]">
                  <VendorLabel vendor="chatgpt" name="ChatGPT" />
                  <ClipPlayer src="/videos/lasso-chatgpt.mp4" poster="/videos/poster-chatgpt.jpg" width={720} height={672} cover aspect="4 / 3" label="Work happening inside ChatGPT" playback="hold" />
                </div>
                <div className="sm:translate-y-5 sm:rotate-[0.5deg]">
                  <VendorLabel vendor="claude" name="Claude" />
                  <ClipPlayer src="/videos/lasso-claude.mp4" poster="/videos/poster-claude.jpg" width={720} height={672} cover aspect="5 / 4" label="Work happening inside Claude" playback="hold" />
                </div>
                <div className="sm:rotate-[0.4deg]">
                  <VendorLabel vendor="gemini" name="Gemini" />
                  <ClipPlayer src="/videos/lasso-gemini.mp4" poster="/videos/poster-gemini.jpg" width={720} height={374} cover aspect="5 / 4" label="Work happening inside Gemini" playback="hold" />
                </div>
                <div className="sm:translate-y-5 sm:-rotate-[0.5deg]">
                  <VendorLabel vendor="lovable" name="Lovable" />
                  <ClipPlayer src="/videos/lasso-lovable.mp4" poster="/videos/poster-lovable.jpg" width={720} height={374} cover aspect="4 / 3" label="Work happening inside Lovable" playback="hold" />
                </div>
              </div>
            </FocusSection>
            </div>
          </div>

          <section className="landing-next-carousel mt-20" aria-label="How Lasso works">
            <div className="landing-next-carousel-sticky">
              <div className="landing-next-carousel-track">
                <section className="landing-next-carousel-panel">
                  <div className="landing-next-carousel-content">
                    <div>
                      <p className="micro-label">THE ONE THING NOBODY ELSE CAN SHOW</p>
                      <h2 className="pencil-title mt-4">Circle any fact. See where it came from.</h2>
                      <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
                        Drop a deck on the board. The conversations that fed it come forward with the
                        exact sentence, quoted, and why. Across ChatGPT, Claude, Gemini and whatever
                        else your team used.
                      </p>
                    </div>
                  </div>
                </section>

                <section className="landing-next-carousel-panel landing-next-carousel-panel-sources">
                  <div className="landing-next-carousel-content">
                    <div>
                      <p className="micro-label">THE ENGAGEMENT, LAID OUT</p>
                      <h2 className="pencil-title mt-4">
                        Sources, AI work, your team's decisions, the deliverable. One board, in that order.
                      </h2>
                      <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
                        Every engagement gets a board: one frame per workstream, cards for the brief,
                        the meetings, the chats and the drafts. Your judgment is its own card, not a
                        comment in the margin. Draw a line and say what it means: informed, produced,
                        revised, cited. Nothing on the board feeds AI by proximity. What fed this
                        follows the lines you drew, never a guess.
                      </p>
                      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                        Your engagement team sees the same board. Coaches read, they don't edit.
                      </p>
                    </div>
                    <div className="landing-next-source-clips">
                      <ClipPlayer
                        src={connectorVideo.url}
                        poster={connectorPoster.url}
                        width={1920}
                        height={1132}
                        aspect="1920 / 1132"
                        label="Work arriving in Lasso from connected tools"
                        group="landing-sources"
                        playback="hold"
                      />
                      <ClipPlayer
                        src={claudePushVideo.url}
                        poster={claudePushPoster.url}
                        width={1080}
                        height={1920}
                        aspect="9 / 16"
                        label="A Claude conversation being sent to Lasso"
                        group="landing-sources"
                        playback="hold"
                      />
                    </div>
                  </div>
                </section>

                <section className="landing-next-carousel-panel">
                  <div className="landing-next-carousel-content">
                    <div>
                      <p className="micro-label">DECISIONS</p>
                      <h2 className="pencil-title mt-4">
                        The decisions you made, written down before you forget them
                      </h2>
                      <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
                        Lasso drafts the decision from the conversation. You confirm it or discard it.
                        The firm's judgment stops living in chat scroll, and the client gets a “how we
                        got here” page with the deliverable.
                      </p>
                    </div>
                    <ClipSlot id="decisions" src="/videos/decisions.mp4" poster="/videos/decisions-poster.png" label="A decision drafted from a conversation" />
                  </div>
                </section>

                <section className="landing-next-carousel-panel">
                  <div className="landing-next-carousel-content">
                    <div>
                      <p className="micro-label">WHAT LANDS</p>
                      <h2 className="pencil-title mt-4">Everything you made this week, in one inbox</h2>
                      <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
                        Chats, files, meetings and drafts arrive as they happen. You shape them into
                        work, or leave them. Nothing is lost, nothing is required.
                      </p>
                    </div>
                    <ClipSlot id="inbox" src="/videos/inbox.mp4" poster="/videos/inbox-poster.png" label="Work arriving in one inbox" />
                  </div>
                </section>
              </div>
              <div className="landing-next-carousel-progress" aria-hidden="true">
                {Array.from({ length: 4 }, (_, index) => (
                  <span key={index} className={`landing-next-carousel-dash landing-next-carousel-dash-${index + 1}`} />
                ))}
              </div>
            </div>
          </section>

          <div className="mx-auto max-w-3xl px-6 md:px-10">
            <FocusSection className="mt-20 border-t border-rule pt-10">
              <p className="micro-label">YOUR COACH</p>
              <h2 className="pencil-title mt-4">A note in the margin, not a report on you</h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
                A coach picks one piece of work and writes to you about it. It shows up as a circle,
                opens as a conversation, and you write back. Not prescriptive. It shows how people
                work, it does not tell them how to work.
              </p>
              <div className="mt-6">
                <ClipSlot id="coach-note" src="/videos/coach-note.mp4" poster="/videos/coach-note-poster.png" label="A coach note opening as a conversation" />
              </div>
            </FocusSection>

            <FocusSection className="mt-20 border-t border-rule pt-10">
              <p className="micro-label">PRIVACY, DEMONSTRATED</p>
              <h2 className="pencil-title mt-4">What a coach sees.</h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
                Your work is private by default. You choose what to share with an engagement lead or
                coach, and they see only that. The firm sees work people chose to place there, never
                a feed of what anyone is doing.
              </p>
              <div className="mt-8"><PrivacyToggleDemo /></div>
            </FocusSection>

            <FocusSection className="mt-20 border-t border-rule pt-10">
              <p className="micro-label">WHAT ACCUMULATES</p>
              <h2 className="pencil-title mt-4">A library your firm can learn from</h2>
              <p className="mt-5 text-base leading-relaxed text-foreground">
                Copilot sees Microsoft. Gemini sees Google. ChatGPT sees ChatGPT. Your engagements
                cross all of them. Lasso keeps the one record that spans tools, and over an
                engagement, then a practice, then a firm, that record becomes how this kind of
                analysis gets built here.
              </p>
              <p className="mt-4 text-base leading-relaxed text-foreground">
                The work belongs to the people who did it.
              </p>
              <figure className="mt-8">
                <img src={pastWorkLibrary.url} alt="A firm library of finished work" width={1962} height={1174} loading="lazy" decoding="async" className="w-full rounded-[var(--radius)] border border-rule shadow-card" />
              </figure>
            </FocusSection>

            <div id="pilot">
            <FocusSection className="mt-20 border-t border-rule pt-10">
              <p className="micro-label">PILOT</p>
              <h2 className="pencil-title mt-4">Run it on one engagement.</h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
                Four months, one real engagement, your team, your tools. You keep every record whether
                or not you continue.
              </p>
              <p className="mt-3 max-w-2xl font-mono text-[11.5px] text-muted-foreground">
                Fixed fee for the pilot. No per-seat pricing until you've seen it work.
              </p>

              {submitted ? (
                <p className="mt-8 border-l-2 border-green pl-4 text-base text-foreground" role="status">
                  Thanks. Liam will be in touch within a day.
                </p>
              ) : (
                <form className="landing-next-pilot-form mt-8 grid gap-5" onSubmit={submitPilotRequest}>
                  <label className="sr-only" aria-hidden="true">
                    <span>Website</span>
                    <input name="website" tabIndex={-1} autoComplete="off" />
                  </label>
                  <label>
                    <span>Name</span>
                    <input name="name" autoComplete="name" required />
                  </label>
                  <label>
                    <span>Firm</span>
                    <input name="firm" autoComplete="organization" required />
                  </label>
                  <label>
                    <span>Work email</span>
                    <input name="email" type="email" autoComplete="email" required />
                  </label>
                  <label>
                    <span>Team size</span>
                    <select name="teamSize" required defaultValue="">
                      <option value="" disabled>Select team size</option>
                      <option value="1-5">1 to 5</option>
                      <option value="6-15">6 to 15</option>
                      <option value="16-40">16 to 40</option>
                      <option value="40+">40+</option>
                    </select>
                  </label>
                  <label>
                    <span>Anything we should know</span>
                    <textarea name="note" rows={4} />
                  </label>
                  <div><Button type="submit" disabled={submitting}>{submitting ? "Sending…" : "Book a pilot"}</Button></div>
                  {submitError ? (
                    <p className="text-sm text-destructive" role="alert">
                      That didn't go through. Email liam@charlotte-labs.com and we'll pick it up.
                    </p>
                  ) : null}
                </form>
              )}

              <a href="mailto:liam@charlotte-labs.com" className="mt-6 inline-block text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground">
                liam@charlotte-labs.com
              </a>
            </FocusSection>
            </div>
          </div>
        </main>

        <footer className="border-t border-rule">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-8 font-mono text-[11px] text-muted-foreground md:px-10">
            <span>Charlotte Labs</span>
            <a href="https://charlotte-labs.com" className="underline underline-offset-4 transition-colors hover:text-foreground">charlotte-labs.com</a>
            <a href="mailto:liam@charlotte-labs.com" className="underline underline-offset-4 transition-colors hover:text-foreground">liam@charlotte-labs.com</a>
            <a href="https://www.linkedin.com/company/charlotte-labs" target="_blank" rel="noreferrer" className="underline underline-offset-4 transition-colors hover:text-foreground">LinkedIn</a>
          </div>
          <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 px-6 pb-8 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground md:px-10">
            <Link to="/why" className="transition-colors hover:text-foreground">Why Lasso</Link>
            <Link to="/trust" className="transition-colors hover:text-foreground">Trust &amp; data</Link>
            <Link to="/personal" className="transition-colors hover:text-foreground">For individuals</Link>
            <Link to="/auth" className="transition-colors hover:text-foreground">Sign in</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
