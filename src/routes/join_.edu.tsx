import { createFileRoute, redirect } from "@tanstack/react-router";

import { markEduIntent } from "@/lib/edu-entry";

export const EDU_JOIN_COPY = {
  eyebrow: "Lasso for students",
  headline: "Your work record. Yours to keep.",
  sub: "Keep every class, workboard and late night draft in one place you own.",
  points: [
    [
      "Every class and workboard in one place",
      "Your AI threads, docs and notes land in the place they belong, so a term of work reads as one story.",
    ],
    [
      "Keep the work you are proud of",
      "Promote a piece to your Portfolio and it stays there, ready when someone asks what you can do.",
    ],
    [
      "Share only what you choose",
      "Share one piece of work with a coach when you choose, and change your mind whenever you like.",
    ],
  ] as const,
  cta: "Create my workspace",
  reassurance: "Free while in beta.",
};

/**
 * F4 / ST-3: School is no longer a workspace type. The old school link sends
 * people to the individual sign-up path with School pre-ticked on the uses
 * question, keeping `from` (for example ceiba_uni). It never mints an edu
 * workspace. The copy above stays exported as dead data for older tests.
 */
export function eduJoinRedirectSearch(search: Record<string, unknown>): {
  intent: "personal";
  mode: "signup";
  from?: string;
} {
  const from = search["from"];
  return {
    intent: "personal",
    mode: "signup",
    ...(typeof from === "string" && from.length > 0 && from.length <= 64 ? { from } : {}),
  };
}

export const Route = createFileRoute("/join_/edu")({
  ssr: false,
  beforeLoad: ({ search }) => {
    markEduIntent();
    throw redirect({ to: "/auth", search: eduJoinRedirectSearch(search) as never, replace: true });
  },
  head: () => ({
    meta: [
      { title: "Lasso for students | Your work record, yours" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => null,
});
