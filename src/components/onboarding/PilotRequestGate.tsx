import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { SessionHeader } from "@/components/layout/SessionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { PILOT_TEAM_SIZES, submitSignupPilotRequestFn } from "@/lib/pilot-request.functions";
import { emitClientEvent } from "@/lib/client-telemetry";

/** GATE-1: company and partner signup asks for a pilot instead of creating a workspace. */
export const PILOT_GATE_COPY = {
  microLabel: "Your organization",
  title: "Request a pilot",
  body: "Lasso for companies starts with a free three month pilot. We set it up by hand, usually within a day.",
  nameLabel: "Your name",
  emailLabel: "Email",
  firmLabel: "Company",
  teamLabel: "Team size",
  noteLabel: "Anything we should know (optional)",
  submit: "Request a pilot",
  submitting: "Sending…",
  justMe: "Just me for now",
  detailsUse: "We use these details to set up your pilot and to contact you about it.",
  pendingTitle: "Request received",
  pending: "Request received. We will email you when your workspace is ready.",
  error: "We could not send your request just now. Please try again.",
} as const;

const TEAM_LABELS: Record<(typeof PILOT_TEAM_SIZES)[number], string> = {
  "1-5": "1 to 5",
  "6-15": "6 to 15",
  "16-40": "16 to 40",
  "40+": "40+",
};

type Props = { register: "company" | "partner"; onJustMe: () => void };

export function PilotRequestGate({ register, onJustMe }: Props) {
  const submit = useServerFn(submitSignupPilotRequestFn);
  const [checking, setChecking] = useState(true);
  const [requested, setRequested] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [firm, setFirm] = useState("");
  const [teamSize, setTeamSize] = useState<(typeof PILOT_TEAM_SIZES)[number]>("1-5");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!live) return;
      if (user) {
        setEmail(user.email ?? "");
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const metaName = meta["display_name"] ?? meta["full_name"] ?? meta["name"];
        if (typeof metaName === "string") setName(metaName);
        // Own-row read under the Oct 20 runbook policy (user_id = auth.uid()).
        const own = await (supabase.from("pilot_requests") as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => { limit: (n: number) => Promise<{ data: unknown[] | null }> };
            };
          };
        })
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .limit(1);
        if (live && own?.data && own.data.length > 0) setRequested(true);
      }
      if (live) setChecking(false);
    })().catch(() => {
      if (live) setChecking(false);
    });
    return () => {
      live = false;
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await submit({
        data: {
          name: name.trim(),
          firm: firm.trim(),
          team_size: teamSize,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      emitClientEvent("pilot.requested", { register, team_size: teamSize });
      setRequested(true);
    } catch {
      setError(PILOT_GATE_COPY.error);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <SessionHeader />
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4 py-16" data-lasso="on">
        <div className="w-full max-w-md">
          <div className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-card">
            <p className="micro-label">{PILOT_GATE_COPY.microLabel}</p>
            {requested ? (
              <div data-testid="pilot-pending">
                <h1 className="page-title mt-2">{PILOT_GATE_COPY.pendingTitle}</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">{PILOT_GATE_COPY.pending}</p>
              </div>
            ) : checking ? null : (
              <>
                <h1 className="page-title mt-2">{PILOT_GATE_COPY.title}</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">{PILOT_GATE_COPY.body}</p>
                <form onSubmit={onSubmit} className="mt-6 space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="pilot-name" className="micro-label">{PILOT_GATE_COPY.nameLabel}</Label>
                    <Input id="pilot-name" required value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pilot-email" className="micro-label">{PILOT_GATE_COPY.emailLabel}</Label>
                    <Input id="pilot-email" value={email} readOnly />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pilot-firm" className="micro-label">{PILOT_GATE_COPY.firmLabel}</Label>
                    <Input id="pilot-firm" required value={firm} onChange={(e) => setFirm(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pilot-team" className="micro-label">{PILOT_GATE_COPY.teamLabel}</Label>
                    <select
                      id="pilot-team"
                      value={teamSize}
                      onChange={(e) => setTeamSize(e.target.value as (typeof PILOT_TEAM_SIZES)[number])}
                      className="h-10 w-full rounded-[var(--radius-control)] border border-input bg-background px-3 text-sm"
                    >
                      {PILOT_TEAM_SIZES.map((t) => (
                        <option key={t} value={t}>{TEAM_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pilot-note" className="micro-label">{PILOT_GATE_COPY.noteLabel}</Label>
                    <textarea
                      id="pilot-note"
                      value={note}
                      maxLength={2000}
                      onChange={(e) => setNote(e.target.value)}
                      className="min-h-20 w-full rounded-[var(--radius-control)] border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  <Button type="submit" className="w-full" disabled={sending}>
                    {sending ? PILOT_GATE_COPY.submitting : PILOT_GATE_COPY.submit}
                  </Button>
                  <p className="text-xs text-muted-foreground">{PILOT_GATE_COPY.detailsUse}</p>
                  <button
                    type="button"
                    onClick={onJustMe}
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {PILOT_GATE_COPY.justMe}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
