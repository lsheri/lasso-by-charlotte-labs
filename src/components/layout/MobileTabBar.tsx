import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

import { CoachAskSheet } from "@/components/coaching/CoachAskSheet";
import { GraphiteIcon } from "@/components/notebook/icons";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useEngagements } from "@/hooks/use-engagements";

import { OrgSwitcher } from "./OrgSwitcher";
import { engagementDisplayTitle } from "@/lib/clients";
import { signOut } from "@/lib/sign-out";
import { logEvent } from "@/lib/telemetry";
import type { NavOpenedDims } from "@/lib/telemetry-shared";
import { useSettingsDialogOptional } from "@/lib/settings-dialog-context";
import { navFor, TAB_ITEMS } from "./nav-config";
import { useNavCtx } from "./use-nav-ctx";
import { WorkspaceMenuItems } from "./WorkspaceMenuItems";

export function MobileTabBar() {
  const { ctx, profile, profiles, vocab, guestNav, labels } = useNavCtx();
  const settings = useSettingsDialogOptional();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);
  const [coachAskOpen, setCoachAskOpen] = useState(false);
  const [engOpen, setEngOpen] = useState(false);
  const { data: engagements } = useEngagements(profile?.id);

  const canReview = ctx.canReview;
  const manifest = navFor(ctx, labels);
  const workspaceItems = manifest.filter((group) => group.placement === "workspace_menu").flatMap((group) => group.items);
  const groups = manifest
    .filter((group) => group.placement !== "workspace_menu")
    .filter((group) => group.id !== "engagements")
    .map((group) => ({ ...group, items: group.items.filter((item) => item.id !== "all-work") }))
    .filter((group) => group.items.length > 0);
  const tabs = guestNav
    ? [...(canReview ? [TAB_ITEMS.coaching, TAB_ITEMS.prep, { ...TAB_ITEMS.coachAsk, action: "coach-ask" as const }] : [TAB_ITEMS.prep]), TAB_ITEMS.more]
    : [TAB_ITEMS.work, TAB_ITEMS.workboards, TAB_ITEMS.more];

  function opened(item: NavOpenedDims["item"], surface: NavOpenedDims["surface"]) {
    if (profile?.org_id) logEvent("nav.opened", profile.org_id, { item, surface } satisfies NavOpenedDims);
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
              onClick={() => opened(tab.id, "tab")}
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
                opened(tab.id, "tab");
                if (tab.action === "coach-ask") setCoachAskOpen(true);
                else if (tab.action === "engagements") setEngOpen(true);
                else setMoreOpen(true);
              }}
              className={`nb-tab ${
                (tab.action === "more" && moreOpen) ||
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

      {canReview ? <CoachAskSheet open={coachAskOpen} onOpenChange={setCoachAskOpen} /> : null}

      <Sheet open={engOpen} onOpenChange={setEngOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto border-border bg-card pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="font-mono text-[13px] uppercase tracking-[0.12em] text-muted-foreground">
            Workboards
          </SheetTitle>
          <div className="mt-3 flex flex-col gap-0.5">
            {(engagements ?? []).map((engagement) => (
              <Link
                key={engagement.id}
                to="/engagements/$id"
                params={{ id: engagement.id }}
                onClick={() => { opened("board", "workboards_sheet"); setEngOpen(false); }}
                className="nb-nav-item min-h-[48px]"
                activeProps={{ className: "nb-nav-item-active" }}
              >
                <GraphiteIcon name="engagement" size={16} />
                <span className="truncate">{engagementDisplayTitle(engagement)}</span>
              </Link>
            ))}
            {engagements && engagements.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">{vocab.noEngagements}</p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto border-border bg-card pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="font-mono text-[13px] uppercase tracking-[0.12em] text-muted-foreground">
            {profile?.display_name ?? "You"}
          </SheetTitle>
          <div className="mt-3 flex flex-col gap-0.5">
            {groups.map((group) => (
              <section key={group.id} data-nav-group={group.id}>
                <div className="nb-group-header">{group.label}</div>
                {group.items.map((item) => {
                  const content = <><GraphiteIcon name={item.icon} size={16} /><span>{item.label}</span></>;
                  if (item.disabled) return (
                    <button key={item.id} type="button" aria-disabled="true" title={item.disabledReason}
                      data-nav-item={item.id} className="nb-nav-item nb-nav-item-disabled min-h-[48px] w-full text-left">
                      <GraphiteIcon name={item.icon} size={16} />
                      <span className="flex flex-1 items-center justify-between gap-2"><span>{item.label}</span><span className="font-mono text-[12px] uppercase tracking-[0.08em]">{item.disabledReason}</span></span>
                    </button>
                  );
                  if (item.action === "openSettings") return (
                    <button key={item.id} type="button" data-nav-item={item.id} className="nb-nav-item min-h-[48px] w-full text-left"
                      onClick={() => { opened(item.id, "more"); setMoreOpen(false); settings?.openSettings(); }}>
                      {content}
                    </button>
                  );
                  if (!item.to) return null;
                  return <Link key={item.id} to={item.to} {...(item.search ? { search: item.search } : {})} {...(item.hash ? { hash: item.hash } : {})}
                    data-nav-item={item.id} onClick={() => { opened(item.id, "more"); setMoreOpen(false); }}
                    className="nb-nav-item min-h-[48px]" activeProps={{ className: "nb-nav-item-active" }}>
                    {content}
                  </Link>;
                })}
              </section>
            ))}
          </div>
          {profiles.length > 1 ? (
            <div className="mt-4" data-testid="mobile-workspace-switcher">
              <OrgSwitcher profiles={profiles} active={profile} />
            </div>
          ) : null}
          <section className="mt-4 border-t border-border pt-3" data-nav-group="workspace_menu">
            <div className="nb-group-header">Workspace</div>
            <WorkspaceMenuItems items={workspaceItems} onOpened={(item) => opened(item, "more")}
              onSettings={() => settings?.openSettings()} onSignOut={() => void signOut(navigate)}
              onNavigate={() => setMoreOpen(false)} />
          </section>
        </SheetContent>
      </Sheet>
    </>
  );
}
