import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { GOAL_COPY, GOAL_SETTING_KEY, goalChoices, goalHours, goalLabel, goalToSave } from "@/lib/proposal-desk-shared";
import { settingsChangedDims } from "@/lib/settings-events";
import { logEvent } from "@/lib/telemetry";
import { profileHasFirmView } from "@/lib/workspace-capabilities";

/**
 * 20 Nov 2026, the Proposal Desk: the form for a workspace's turnaround goal. One short list to pick from, so nobody
 * types a number. The field stays locked until the saved goal has loaded, so a late load cannot replace a choice.
 */
export function ProposalGoalForm({
  saved,
  canEdit,
  onSave,
}: {
  /** The saved goal in hours; undefined while it loads. */
  saved: number | undefined;
  canEdit: boolean;
  onSave: (hours: number) => Promise<boolean>;
}) {
  const [value, setValue] = useState<number | undefined>(saved);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<{ kind: "saved" | "failed"; text: string } | null>(null);

  useEffect(() => {
    setValue(saved);
  }, [saved]);

  async function save() {
    if (value === undefined || pending) return;
    setPending(true);
    setNote(null);
    let ok = false;
    try {
      ok = await onSave(value);
    } catch {
      ok = false;
    }
    setPending(false);
    setNote(ok ? { kind: "saved", text: GOAL_COPY.saved } : { kind: "failed", text: GOAL_COPY.failed });
  }

  return (
    <section data-testid="proposal-goal-card">
      <h2 className="micro-label micro-label-section">{GOAL_COPY.title}</h2>
      <div className="mt-3 space-y-3 rounded-[var(--radius)] border border-border bg-card px-4 py-4 shadow-card">
        <p className="text-sm text-muted-foreground">{GOAL_COPY.line}</p>
        {!canEdit ? (
          <p className="text-sm text-foreground">{saved === undefined ? "" : GOAL_COPY.readOnly(saved)}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <NativeSelect
              aria-label={GOAL_COPY.label}
              className="w-auto"
              disabled={saved === undefined || pending}
              value={value === undefined ? "" : String(value)}
              onChange={(event) => {
                const next = goalToSave(event.target.value);
                if (next !== null) setValue(next);
                setNote(null);
              }}
            >
              {value === undefined ? <option value="" /> : null}
              {goalChoices(saved ?? value ?? 72).map((hours) => (
                <option key={hours} value={hours}>
                  {goalLabel(hours)}
                </option>
              ))}
            </NativeSelect>
            <Button type="button" variant="outline" size="sm" disabled={saved === undefined || pending || value === saved} onClick={() => void save()}>
              {pending ? GOAL_COPY.saving : GOAL_COPY.save}
            </Button>
          </div>
        )}
        {note ? (
          <p role={note.kind === "failed" ? "alert" : "status"} className={note.kind === "failed" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {note.text}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The card in Settings, Workspace. Company workspaces only. An admin picks; everyone else in the workspace reads the
 * goal. It is saved the way the other workspace settings are, so the same rule decides who may write it.
 */
export function ProposalGoalCard() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const show = profileHasFirmView(profile) && !profile?.is_guest && profile?.role !== "coach";
  const orgId = show ? profile?.org_id : undefined;

  const { data: settings } = useQuery({
    queryKey: ["org-settings", orgId],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<Record<string, unknown>> => {
      const { data, error } = await supabase.from("orgs").select("settings").eq("id", orgId as string).maybeSingle();
      if (error) throw error;
      return (data?.settings as Record<string, unknown> | null) ?? {};
    },
  });

  if (!show || !profile) return null;

  async function save(hours: number): Promise<boolean> {
    if (!orgId) return false;
    // Read again just before writing, so a setting someone else changed a moment ago is not written over.
    const fresh = await supabase.from("orgs").select("settings").eq("id", orgId).maybeSingle();
    if (fresh.error || !fresh.data) return false;
    const merged = { ...((fresh.data.settings as Record<string, unknown> | null) ?? {}), [GOAL_SETTING_KEY]: hours };
    const written = await supabase.from("orgs").update({ settings: merged as never }).eq("id", orgId).select("id");
    // Zero rows back means the database refused it without an error.
    if (written.error || (written.data ?? []).length !== 1) return false;
    await queryClient.invalidateQueries({ queryKey: ["org-settings", orgId] });
    await queryClient.invalidateQueries({ queryKey: ["proposal-desk"] });
    const dims = settingsChangedDims({ section: "workspace", setting: "proposal_goal", change: "updated" });
    if (dims) logEvent("settings.changed", orgId, dims);
    return true;
  }

  return <ProposalGoalForm saved={settings ? goalHours(settings) : undefined} canEdit={profile.role === "admin"} onSave={save} />;
}
