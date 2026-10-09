import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { parseInvite } from "@/components/invites/EnterInviteCode";
import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { EntryDoorLink } from "@/components/layout/EntryDoorLink";
import { rememberEntryDoor } from "@/lib/entry-door";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emitClientEvent } from "@/lib/client-telemetry";
import type { SignupSource } from "@/lib/edu-entry";
import { parseFunnelSource, type FunnelSource } from "@/lib/funnel-source";
import { isPartnerSlug } from "@/lib/partners";
import { cleanActivationKey, isActivationKeyShape } from "@/lib/key-entry";

export type PlansSearch = { src?: FunnelSource | undefined; from?: SignupSource | undefined };

export function validatePlansSearch(search: Record<string, unknown>): PlansSearch {
  const src = parseFunnelSource(search["src"]);
  const from = search["from"];
  return {
    ...(src ? { src } : {}),
    ...(isPartnerSlug(from) || from === "edu" || from === "direct" ? { from } : {}),
  };
}

export const Route = createFileRoute("/plans")({
  validateSearch: validatePlansSearch,
  head: () => ({
    meta: [
      { title: "Plans | Lasso" },
      {
        name: "description",
        content: "Pick the plan that fits how you work. Every plan is free while we pilot.",
      },
      { property: "og:title", content: "Plans | Lasso" },
      {
        property: "og:description",
        content: "Pick the plan that fits how you work. Every plan is free while we pilot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://lasso.charlotte-labs.com/plans" }],
  }),
  component: PlansRoute,
});

function PlansRoute() {
  return <PlansPage search={Route.useSearch()} />;
}

const PLANS = [
  {
    name: "Just me",
    forLine: "FOR ONE PERSON",
    price: "$0/mo",
    note: "free while we pilot",
    intent: "personal",
    edge: "border-l-green",
    features: [
      "every AI conversation you push or capture, in one place",
      "push from Claude and ChatGPT",
      "connect Drive, Gmail and Granola",
      "circle a few chats and ask",
      "pick a thread back up months later",
    ],
  },
  {
    name: "School",
    forLine: "FOR STUDENTS",
    price: "$0/mo",
    note: "free while we pilot",
    intent: "edu",
    edge: "border-l-blue",
    plus: true,
    features: [
      "your classes and coursework in one place",
      "keep the chat where the idea came from",
      "share one piece of work when you choose",
      "your record leaves with you",
      "take your work with you when the term ends",
    ],
  },
  {
    name: "Team",
    forLine: "FOR A COMPANY OR A GROUP AT WORK",
    price: "$0/person/mo",
    note: "free while we pilot",
    intent: "company",
    edge: "border-l-state-amber",
    plus: true,
    featured: true,
    features: [
      "invite your team by email",
      "hand off work with the thinking still attached",
      "what the team worked out, still there next year",
      "trace a fact in a deliverable back to its source",
      "hand over a board with the thinking still attached",
    ],
  },
  {
    name: "Partner",
    forLine: "FOR PRACTICES RUNNING COHORTS",
    price: "By arrangement",
    note: "free for our pilot partners",
    edge: "border-l-[var(--nb-shared)]",
    features: [
      "one workspace for your own work, one for each cohort",
      "seats and length come from your key",
      "people keep their workspace when the engagement ends",
      "share a whole conversation, not just the answer",
      "you see what people share with you",
    ],
  },
] as const;

export const CODE_ENTRY_ERROR = "We do not recognise that code. Check it against the message you were sent.";

function CodeEntry() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = cleanActivationKey(code);
    if (clean && isActivationKeyShape(clean)) {
      setError(null);
      navigate({ to: "/j/$code", params: { code: clean } });
      return;
    }
    const invite = parseInvite(code);
    if (invite) {
      setError(null);
      navigate({
        to: "/join",
        search: invite.eng ? { code: invite.code, eng: invite.eng } : { code: invite.code },
      });
      return;
    }
    setError(CODE_ENTRY_ERROR);
  }

  return (
    <form onSubmit={submit} className="min-w-0">
      <Label htmlFor="entry-code" className="micro-label">
        Enter the code you were sent
      </Label>
      <div className="mt-3 flex min-w-0 gap-2">
        <Input
          id="entry-code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            if (error) setError(null);
          }}
          className="min-w-0 font-mono"
          autoComplete="off"
        />
        <Button type="submit" variant="outline">
          Continue
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </form>
  );
}

export function PlansPage({ search = {} }: { search?: PlansSearch }) {
  const { src, from } = search;
  const eventSrc = src ?? "direct";

  useEffect(() => {
    emitClientEvent("plans.viewed", { src: eventSrc }, { stableVisitor: true });
  }, [eventSrc]);
  useEffect(() => {
    if (src) rememberEntryDoor(src);
  }, [src]);

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <header className="border-b border-rule">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-5 md:px-10">
          <EntryDoorLink className="flex items-center gap-2 font-mono text-sm tracking-[0.18em]">
            <LassoLoopMark className="h-8 w-8 text-lasso-green" />
            <span>LASSO</span>
          </EntryDoorLink>
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-12 md:px-10 md:py-16">
        <div className="max-w-3xl">
          <h1 className="font-sans text-4xl font-semibold leading-tight md:text-6xl">Plans</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Pick the one that sounds like you. It sets up your workspace and the words in it, and
            you can change it later.
          </p>
          <p className="mt-5 inline-flex rounded-[var(--radius-pill)] border border-rule bg-grey-1 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em]">
            Everything is $0 while we pilot
          </p>
        </div>

        <div className="mt-10 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <article
              key={plan.name}
              className={`flex min-w-0 flex-col border border-rule border-l-[3px] bg-card p-5 ${plan.edge}`}
            >
              <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                {plan.forLine}
              </p>
              <h2 className="mt-3 font-sans text-[26px] font-semibold leading-tight">{plan.name}</h2>
              <p className="mt-5 min-h-10 text-xl font-semibold">{plan.price}</p>
              <p className="min-h-8 font-hand text-[16px] leading-5 text-green">{plan.note}</p>
              {"intent" in plan ? (
                <Button
                  asChild
                  variant={"featured" in plan && plan.featured ? "ink" : "outline"}
                  className="mt-4 w-full"
                >
                  <Link
                    to="/auth"
                    search={{ intent: plan.intent, ...(src ? { src } : {}), ...(from ? { from } : {}) }}
                    onClick={() => emitClientEvent("plan.picked", { plan: plan.intent, src: eventSrc }, { stableVisitor: true })}
                  >
                    Get started
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-4 w-full"
                  disabled
                  aria-disabled="true"
                >
                  Coming soon
                </Button>
              )}
              <div className="mt-6 border-t border-rule pt-5">
                {"plus" in plan && plan.plus ? (
                  <p className="mb-3 text-sm font-medium">everything in Just me plus:</p>
                ) : null}
                <ul className="space-y-3 text-sm leading-5">
                  {plan.features.map((feature, index) => (
                    <li key={feature} className="flex gap-2">
                      <span aria-hidden="true" className="text-green">
                        ✓
                      </span>
                      {index === plan.features.length - 1 && plan.name !== "Just me" ? (
                        <strong>{feature}</strong>
                      ) : (
                        <span>{feature}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <section className="mt-12 border-y border-rule py-8">
          <div className="max-w-xl">
            <CodeEntry />
          </div>
        </section>

        <p className="mx-auto mt-8 max-w-4xl text-center text-xs leading-5 text-muted-foreground">
          Every plan is $0 while we pilot. When pricing turns on, billing runs through Stripe and
          nothing is charged without your yes.
        </p>
      </main>
    </div>
  );
}