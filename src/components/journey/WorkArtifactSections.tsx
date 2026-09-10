import type { ReactNode } from "react";

import {
  ARTIFACT_SECTION_AREAS,
  NO_DECISIONS_LINE,
  NO_PROCESS_LINE,
  NO_PROMPTS_LINE,
  NO_STAGES_LINE,
  NO_VERIFICATION_LINE,
  WORK_ARTIFACT_SECTIONS,
  artifactSectionDelayMs,
  type ArtifactDecision,
  type TurnRef,
  type WorkArtifact,
} from "@/lib/work-artifact-shared";


/**
 * Pass 113. The artifact itself: six bordered cards that teach how the work was
 * made, each entering one at a time after the spine has drawn. Everything here
 * survived the honesty gate on the server, so nothing needs hedging in the UI.
 */

function refLine(refs: TurnRef[]): string | null {
  if (refs.length === 0) return null;
  return refs.map((ref) => `turn ${ref.turn_no}`).join(" · ");
}

function decidedByLabel(decision: ArtifactDecision): string {
  if (decision.decided_by === "person") return "decided by the person";
  if (decision.decided_by === "ai") return "decided by the model";
  return "the record does not say who decided";
}

function Micro({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </p>
  );
}

function Section({
  label,
  index,
  drawing,
  startMs,
  children,
}: {
  label: string;
  index: number;
  drawing: boolean;
  startMs: number;
  children: ReactNode;
}) {
  const classes = ["nb-artifact-section", drawing ? "" : "nb-artifact-section-static"]
    .filter(Boolean)
    .join(" ");
  const area = ARTIFACT_SECTION_AREAS[index] ?? "usage";
  return (
    <section
      className={`${classes} nb-a-${area} rounded-[var(--radius-md)] border border-pencil bg-card px-4 py-3.5`}
      style={drawing ? { animationDelay: `${artifactSectionDelayMs(index, startMs)}ms` } : undefined}
      data-section={label}
      data-area={area}
    >
      <p className="micro-label text-muted-foreground">{label}</p>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return (
    <p className="border-t border-border pt-2.5 font-serif text-[13px] italic text-muted-foreground">
      {children}
    </p>
  );
}

export function WorkArtifactSections({
  artifact,
  drawing = false,
  startMs = 0,
}: {
  artifact: WorkArtifact;
  drawing?: boolean;
  startMs?: number;
}) {
  return (
    <div className="nb-artifact-grid" data-testid="work-artifact">

      <Section label={WORK_ARTIFACT_SECTIONS.how} index={0} drawing={drawing} startMs={startMs}>
        {artifact.how_ai_was_used.length === 0 ? (
          <Quiet>{NO_STAGES_LINE}</Quiet>
        ) : (
          <ol className="list-none space-y-3">
            {artifact.how_ai_was_used.map((stage, i) => (
              <li key={`${stage.stage}-${i}`}>
                <p className="text-sm font-medium text-foreground">{stage.stage}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-foreground">
                  {stage.what_happened}
                </p>
                {refLine(stage.turn_refs) ? <Micro>{refLine(stage.turn_refs)}</Micro> : null}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section label={WORK_ARTIFACT_SECTIONS.prompts} index={1} drawing={drawing} startMs={startMs}>
        {artifact.example_prompts.length === 0 ? (
          <Quiet>{NO_PROMPTS_LINE}</Quiet>
        ) : (
          <ul className="list-none space-y-3">
            {artifact.example_prompts.map((prompt, i) => (
              <li key={`${i}-${prompt.quote.slice(0, 20)}`}>
                <blockquote className="nb-binder nb-binder-body rounded-[var(--radius-md)] border border-pencil px-3 text-[13px] text-foreground">
                  {prompt.quote}
                </blockquote>
                {prompt.why_it_worked ? (
                  <p className="mt-1 text-[13px] leading-snug text-foreground">
                    {prompt.why_it_worked}
                  </p>
                ) : null}
                {prompt.turn_ref ? <Micro>{`turn ${prompt.turn_ref.turn_no}`}</Micro> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section label={WORK_ARTIFACT_SECTIONS.checks} index={2} drawing={drawing} startMs={startMs}>
        {artifact.verification_steps.length === 0 ? (
          <Quiet>{NO_VERIFICATION_LINE}</Quiet>
        ) : (
          <ul className="list-none space-y-3">
            {artifact.verification_steps.map((check, i) => (
              <li key={`${check.step}-${i}`}>
                <p className="text-sm font-medium text-foreground">{check.step}</p>
                {check.evidence ? (
                  <p className="mt-0.5 text-[13px] leading-snug text-foreground">
                    {check.evidence}
                  </p>
                ) : null}
                {refLine(check.turn_refs) ? <Micro>{refLine(check.turn_refs)}</Micro> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        label={WORK_ARTIFACT_SECTIONS.decisions}
        index={3}
        drawing={drawing}
        startMs={startMs}
      >
        {artifact.decisions.length === 0 ? (
          <Quiet>{NO_DECISIONS_LINE}</Quiet>
        ) : (
          <ul className="list-none space-y-3">
            {artifact.decisions.map((decision, i) => (
              <li key={`${decision.decision.slice(0, 20)}-${i}`}>
                <p className="text-[13px] leading-snug text-foreground">{decision.decision}</p>
                <Micro>
                  {[decidedByLabel(decision), refLine(decision.turn_refs)]
                    .filter(Boolean)
                    .join(" · ")}
                </Micro>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section label={WORK_ARTIFACT_SECTIONS.process} index={4} drawing={drawing} startMs={startMs}>
        {artifact.process_steps.length === 0 ? (
          <Quiet>{NO_PROCESS_LINE}</Quiet>
        ) : (
          <ol className="list-decimal space-y-1.5 pl-5">
            {artifact.process_steps.map((step, i) => (
              <li key={`${i}-${step.slice(0, 20)}`} className="text-[13px] leading-snug text-foreground">
                {step}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section label={WORK_ARTIFACT_SECTIONS.gaps} index={5} drawing={drawing} startMs={startMs}>
        <ul className="list-none space-y-1.5">
          {artifact.honest_gaps.map((gap, i) => (
            <li key={`${i}-${gap.slice(0, 20)}`} className="text-[13px] leading-snug text-muted-foreground">
              {gap}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
