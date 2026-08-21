import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

import { CoachAskSheet } from "@/components/coaching/CoachAskSheet";
import { GraphiteIcon, type GraphiteIconName } from "@/components/notebook/icons";
import { FeedbackDialog } from "@/components/feedback/FeedbackWidget";
import { useAskLassoHandler } from "@/components/reflect/ask-lasso-context";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useEngagements } from "@/hooks/use-engagements";
import { isBusinessOrg, useProfile } from "@/hooks/use-profile";
import { engagementDisplayCode, engagementDisplayTitle } from "@/lib/clients";
import { supabase } from "@/integrations/supabase/client";

type Dest = { label: string; to: string; icon: GraphiteIconName };

/**
 * On phones the drawer is gone: four destinations sit in the thumb zone and
 * everything else lives one tap deeper in the You sheet. Desktop keeps the
 * sidebar untouched.
 */
export function MobileTabBar() {
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const handler = useAskLassoHandler();
  const [youOpen, setYouOpen] = useState(false);
  const [coachAskOpen, setCoachAskOpen] = useState(false);
  const [engOpen, setEngOpen] = useState(false);
  const { data: engagements } = useEngagements(profile?.id);

  const isCoach = profile?.role === "coach";
  const canManageMembers = profile?.role === "admin" || profile?.role === "lead";
  const canSeeFirmView = canManageMembers && isBusinessOrg(profile);
  const membersLabel = isBusinessOrg(profile) ? "Members" : "Your coaches";

  // A coach has no work of their own, and no personal Reflect space, so an Ask
  // tab would be a dead affordance the way the FAB would be. Three tabs.
  const you: Dest[] = isCoach
    ? [
        { label: "1:1 prep", to: "/one-on-one", icon: "one-on-one" },
        { label: "Settings", to: "/settings", icon: "settings" },
      ]
    : [
        { label: "Overview", to: "/overview", icon: "overview" },
        { label: "Reflect", to: "/reflect", icon: "reflect" },
        { label: "AI record", to: "/ai-record", icon: "ai-record" },
        { label: "Decision log", to: "/decisions", icon: "decisions" },
        { label: "1:1 prep", to: "/one-on-one", icon: "one-on-one" },
        ...(canSeeFirmView ? [{ label: "Firm view", to: "/firm", icon: "firm" as const }] : []),
        ...(canManageMembers
          ? [{ label: membersLabel, to: "/members", icon: "members" as const }]
          : []),
        { label: "Settings", to: "/settings", icon: "settings" },
        { label: "Where work lives", to: "/connectors", icon: "connectors" },
      ];

  const tabs: (Dest | { label: string; icon: GraphiteIconName; action: "ask" | "coach-ask" | "you" | "engagements" })[] = isCoach
    ? [
        { label: "Coaching", to: "/coaching", icon: "members" },
        { label: "1:1 prep", to: "/one-on-one", icon: "one-on-one" },
        { label: "Ask", icon: "ask-lasso", action: "coach-ask" },
        { label: "You", icon: "overview", action: "you" },
      ]
    : [
        { label: "Work", to: "/work", icon: "work" },
        { label: "Engagements", icon: "engagement", action: "engagements" },
        { label: "Ask", icon: "ask-lasso", action: "ask" },
        { label: "You", icon: "overview", action: "you" },
      ];


  function askLasso() {
    if (handler) handler();
    else void navigate({ to: "/reflect" });
  }

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <>
      <nav
        aria-label="Primary"
        className="nb-tabbar md:hidden print:hidden"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) =>
          "to" in tab ? (
            <Link
              key={tab.label}
              to={tab.to}
              className={`nb-tab ${path.startsWith(tab.to) ? "nb-tab-active" : ""}`}
            >
              <GraphiteIcon name={tab.icon} size={18} />
              <span>{tab.label}</span>
            </Link>
          ) : (
            <button
              key={tab.label}
              type="button"
              onClick={() => {
                if (tab.action === "ask") askLasso();
                else if (tab.action === "coach-ask") setCoachAskOpen(true);
                else if (tab.action === "engagements") setEngOpen(true);
                else setYouOpen(true);
              }}
              className={`nb-tab ${
                (tab.action === "you" && youOpen) ||
                (tab.action === "coach-ask" && coachAskOpen) ||
                (tab.action === "engagements" && (engOpen || path.startsWith("/engagements")))
                  ? "nb-tab-active"
                  : ""
              }`}
            >
              <GraphiteIcon name={tab.icon} size={18} />
              <span>{tab.label}</span>
            </button>
          ),
        )}
      </nav>

      {isCoach ? <CoachAskSheet open={coachAskOpen} onOpenChange={setCoachAskOpen} /> : null}

      <Sheet open={engOpen} onOpenChange={setEngOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto border-border bg-card pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Engagements
          </SheetTitle>
          <div className="mt-3 flex flex-col gap-0.5">
            {(engagements ?? []).map((engagement) => (
              <Link
                key={engagement.id}
                to="/engagements/$id"
                params={{ id: engagement.id }}
                onClick={() => setEngOpen(false)}
                className="nb-nav-item min-h-[48px]"
                activeProps={{ className: "nb-nav-item-active" }}
              >
                <GraphiteIcon name="engagement" size={16} />
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground">
                    {engagementDisplayCode(engagement) ?? "Folder"}
                  </span>
                  <span className="truncate">{engagementDisplayTitle(engagement)}</span>
                </span>
              </Link>
            ))}
            {engagements && engagements.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">No engagements yet</p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={youOpen} onOpenChange={setYouOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto border-border bg-card pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {profile?.display_name ?? "You"}
          </SheetTitle>
          <div className="mt-3 flex flex-col gap-0.5">
            {you.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setYouOpen(false)}
                className="nb-nav-item min-h-[48px]"
                activeProps={{ className: "nb-nav-item-active" }}
              >
                <GraphiteIcon name={item.icon} size={16} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
            <Link
              to="/trust"
              onClick={() => setYouOpen(false)}
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
            >
              Trust &amp; data
            </Link>
            <Link
              to="/why"
              onClick={() => setYouOpen(false)}
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
            >
              Why Lasso
            </Link>
            <FeedbackDialog
              trigger={
                <button
                  type="button"
                  className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Feedback
                </button>
              }
            />
            <button
              type="button"
              onClick={() => void signOut()}
              className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
            >
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
