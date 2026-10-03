import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { ToneCard } from "@/components/notebook/ToneCard";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";
import { useProfile } from "@/hooks/use-profile";
import type { Database } from "@/integrations/supabase/types";

type KeyRequest = Database["public"]["Tables"]["key_requests"]["Row"];
type KeyRequestInsert = Database["public"]["Tables"]["key_requests"]["Insert"];
type Kind = "company" | "edu" | "personal";

const KINDS: { value: Kind; label: string; help: string }[] = [
  { value: "company", label: "A company", help: "Everyone joins one workspace together." },
  { value: "edu", label: "A school", help: "Everyone joins one school workspace together." },
  {
    value: "personal",
    label: "Individuals",
    help: "Each person gets their own workspace and owns their own record.",
  },
];

const KIND_LABEL: Record<string, string> = { company: "A company", edu: "A school", personal: "Individuals" };
const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  provisioned: "Ready",
  declined: "Declined",
};

export function parseEmails(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export { adminLink, attendeeLink } from "@/lib/join-link";
import { adminLink, attendeeLink } from "@/lib/join-link";

function copy(text: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Could not copy"),
  );
}

function dateLabel(d: string | null) {
  return d ?? "Not set";
}

function Field({ id, label, help, children }: { id: string; label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help ? <p className="text-sm text-muted-foreground">{help}</p> : null}
    </div>
  );
}

export function KeyRequestsPage() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const orgId = profile?.org_id ?? null;
  const listKey = ["key-requests", orgId];

  const [clientName, setClientName] = useState("");
  const [kind, setKind] = useState<Kind | "">("");
  const [adminEmail, setAdminEmail] = useState("");
  const [seats, setSeats] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [emails, setEmails] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const list = useQuery({
    queryKey: listKey,
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("key_requests")
        .select("*")
        .eq("partner_org_id", orgId ?? "")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const needsAdmin = kind === "company" || kind === "edu";
  const seatNum = Number(seats);
  const canSubmit =
    !!profile &&
    clientName.trim().length > 0 &&
    kind !== "" &&
    Number.isInteger(seatNum) &&
    seatNum >= 1 &&
    (!needsAdmin || adminEmail.trim().length > 0);

  const submit = useMutation({
    mutationFn: async (row: KeyRequestInsert) => {
      const { error } = await supabase.from("key_requests").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      setResult({ ok: true, text: "Request sent. We will let you know here once the keys are ready." });
      setClientName("");
      setKind("");
      setAdminEmail("");
      setSeats("");
      setStartsOn("");
      setEndsOn("");
      setEmails("");
      setNote("");
      void qc.invalidateQueries({ queryKey: listKey });
    },
    onError: () => setResult({ ok: false, text: "That request did not go through. Please try again." }),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !profile || submit.isPending) return;
    setResult(null);
    submit.mutate({
      partner_org_id: profile.org_id,
      requested_by: profile.id,
      status: "submitted",
      client_name: clientName.trim(),
      workspace_kind: kind,
      admin_email: needsAdmin ? adminEmail.trim() : null,
      seat_count: seatNum,
      starts_on: startsOn || null,
      ends_on: endsOn || null,
      emails: parseEmails(emails),
      note: note.trim() || null,
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Workshop keys"
        subtitle="Ask for keys for a workshop. The links appear here once they are ready."
        action={
          <a href="/adding-people" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            How adding people works
          </a>
        }
      />

      <section className="mb-10">
        <SectionHeader title="Request keys for a workshop" />
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-5">
          <Field id="kr-client" label="Who is this for" help="The client company or school running the workshop.">
            <Input id="kr-client" required value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </Field>

          <div className="flex flex-col gap-2">
            <Label>What kind of workspace</Label>
            <RadioGroup value={kind} onValueChange={(v) => setKind(v === "company" || v === "edu" || v === "personal" ? v : "")}>
              {KINDS.map((k) => (
                <label key={k.value} htmlFor={`kr-kind-${k.value}`} className="flex cursor-pointer items-start gap-3">
                  <RadioGroupItem id={`kr-kind-${k.value}`} value={k.value} className="mt-1" />
                  <span className="flex flex-col">
                    <span className="text-base">{k.label}</span>
                    <span className="text-sm text-muted-foreground">{k.help}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {needsAdmin ? (
            <Field
              id="kr-admin"
              label="Who will run it at their end"
              help="Their work email. We send them the admin link, and it only works for that address."
            >
              <Input id="kr-admin" type="email" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            </Field>
          ) : null}

          <Field id="kr-seats" label="How many people">
            <Input id="kr-seats" type="number" min={1} step={1} required value={seats} onChange={(e) => setSeats(e.target.value)} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="kr-starts" label="Starts">
              <Input id="kr-starts" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            </Field>
            <Field id="kr-ends" label="Ends" help="Keys stop working after this date.">
              <Input id="kr-ends" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
            </Field>
          </div>

          <Field
            id="kr-emails"
            label="Attendee emails, if you have them"
            help="Optional. Most partners do not have these yet, and the keys work without them."
          >
            <Textarea id="kr-emails" rows={4} value={emails} onChange={(e) => setEmails(e.target.value)} />
          </Field>

          <Field id="kr-note" label="Anything else">
            <Textarea id="kr-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={!canSubmit || submit.isPending} className="self-start">
              {submit.isPending ? "Sending" : "Send request"}
            </Button>
            {result ? (
              <p role="status" className={result.ok ? "text-base text-foreground" : "text-base text-destructive"}>
                {result.text}
              </p>
            ) : null}
          </div>
        </form>
      </section>

      <SharedWithYou orgId={orgId} profileId={profile?.id ?? null} />

      <section>
        <SectionHeader title="Your requests" />
        <div className="mt-4 flex flex-col gap-3">
          {list.isLoading ? <p className="text-base text-muted-foreground">Loading</p> : null}
          {list.error ? <p className="text-base text-destructive">Could not load your requests.</p> : null}
          {list.data && list.data.length === 0 ? (
            <p className="text-base text-muted-foreground">No requests yet.</p>
          ) : null}
          {list.data?.map((r) => <RequestRow key={r.id} r={r} orgId={orgId} />)}
        </div>
      </section>
    </div>
  );
}

function LinkLine({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-[var(--radius-control)] border border-border bg-background px-2 py-1 text-sm">
          {url}
        </code>
        <Button type="button" size="sm" variant="outline" onClick={() => copy(url)}>
          Copy
        </Button>
      </div>
    </div>
  );
}

function RequestRow({ r, orgId }: { r: KeyRequest; orgId: string | null }) {
  const tone = r.status === "provisioned" ? "record" : r.status === "declined" ? "attention" : "paper";
  const attendee = r.issued_code ? attendeeLink(r.issued_code, r.workspace_kind) : null;
  const admin = r.admin_invite_code ? adminLink(r.admin_invite_code) : null;
  return (
    <ToneCard tone={tone}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-base font-medium">{r.client_name}</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-sm">{STATUS_LABEL[r.status] ?? r.status}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {KIND_LABEL[r.workspace_kind] ?? r.workspace_kind} · {r.seat_count} seats · Starts {dateLabel(r.starts_on)} · Ends{" "}
        {dateLabel(r.ends_on)}
      </p>

      {r.status === "submitted" ? <p className="text-sm">Waiting on Lasso.</p> : null}
      {r.status === "declined" && r.decision_note ? <p className="text-sm">{r.decision_note}</p> : null}

      {r.status === "provisioned" ? (
        <div className="mt-2 flex flex-col gap-3">
          {attendee ? (
            <div className="flex flex-col gap-1">
              <LinkLine label="Attendee link" url={attendee} />
              <p className="text-sm text-muted-foreground">Up to {r.seat_count} people.</p>
            </div>
          ) : null}
          {admin ? (
            <div className="flex flex-col gap-1">
              <LinkLine label="Admin link" url={admin} />
              <p className="text-sm text-muted-foreground">
                Send this to {r.admin_email} first. It only works for that address and expires in 14 days.
              </p>
            </div>
          ) : null}
          {r.allowed_domains && r.allowed_domains.length > 0 ? (
            <p className="text-sm">Joining is limited to {r.allowed_domains.map((d) => `@${d}`).join(", ")}.</p>
          ) : null}
          {attendee && admin ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-start"
              onClick={() => copy(`Attendee link: ${attendee}\nAdmin link: ${admin}`)}
            >
              Copy both
            </Button>
          ) : null}
          <SeatRoster requestId={r.id} orgId={orgId} />
        </div>
      ) : null}
    </ToneCard>
  );
}

type SeatPerson = { email: string; status: "added" | "sent" | "joined"; invited_at: string | null; joined_at: string | null };
type SeatSummary = { seats: number; named: number; joined_named: number; joined_total: number; people: SeatPerson[] };

const SEAT_STATUS_LABEL: Record<SeatPerson["status"], string> = { added: "Added", sent: "Invited", joined: "Joined" };

async function unwrapRpc<T>(call: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await call;
  if (error) throw new Error(error.message);
  return data;
}

/** Read a count out of a jsonb rpc result; anything missing or non-numeric becomes 0. */
function rpcCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

type ShareBackPerson = { person: string; code: string; offered_at: string | null; claimed: boolean };

/** People who offered to share back with this partner. Renders nothing when nobody has. */
function SharedWithYou({ orgId, profileId }: { orgId: string | null; profileId: string | null }) {
  const qc = useQueryClient();
  const key = ["share-backs", orgId];
  const people = useQuery({
    queryKey: key,
    enabled: !!orgId,
    queryFn: async () =>
      ((await unwrapRpc(supabase.rpc("partner_share_backs"))) as { people?: ShareBackPerson[] } | null)?.people ?? [],
  });
  const claim = useMutation({
    mutationFn: async (code: string) => {
      if (!profileId) throw new Error("Your profile is still loading. Try again in a moment.");
      return unwrapRpc(supabase.rpc("claim_coaching_links", { p_code: code, p_actor_profile_id: profileId }));
    },
    onSuccess: () => {
      if (orgId) logEvent("share_back.claimed", orgId, {});
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = people.data ?? [];
  if (rows.length === 0) return null;
  return (
    <section>
      <SectionHeader title="Shared with you" />
      <ul className="mt-4 flex flex-col gap-2">
        {rows.map((p) => (
          <li key={p.code} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
            <span className="text-sm text-foreground">{p.person}</span>
            <span className="text-sm text-muted-foreground">{dateLabel(p.offered_at)}</span>
            {p.claimed ? (
              <span className="text-sm text-muted-foreground">Claimed</span>
            ) : (
              <Button type="button" size="sm" disabled={claim.isPending} onClick={() => claim.mutate(p.code)}>
                Claim
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SeatRoster({ requestId, orgId }: { requestId: string; orgId: string | null }) {
  const qc = useQueryClient();
  const key = ["seat-summary", requestId];
  const [raw, setRaw] = useState("");
  const summary = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await unwrapRpc(supabase.rpc("partner_seat_summary", { p_request_id: requestId }))) as SeatSummary,
  });
  const onError = (e: Error) => toast.error(e.message);
  const refresh = () => void qc.invalidateQueries({ queryKey: key });

  const add = useMutation({
    mutationFn: (emails: string[]) =>
      unwrapRpc(supabase.rpc("partner_add_seat_emails", { p_request_id: requestId, p_emails: emails })),
    onSuccess: (data) => {
      setRaw("");
      refresh();
      if (orgId) logEvent("seat.named", orgId, { count: rpcCount((data as { added?: unknown }).added), source: "roster" });
    },
    onError,
  });
  const send = useMutation({
    mutationFn: () => unwrapRpc(supabase.rpc("partner_send_seat_invites", { p_request_id: requestId })),
    onSuccess: (data) => {
      refresh();
      if (orgId) logEvent("invite.sent", orgId, { count: rpcCount((data as { sent?: unknown }).sent) });
    },
    onError,
  });
  const revoke = useMutation({
    mutationFn: (email: string) =>
      unwrapRpc(supabase.rpc("partner_revoke_seat_grant", { p_request_id: requestId, p_email: email })),
    onSuccess: () => {
      refresh();
      if (orgId) logEvent("seat.revoked", orgId, {});
    },
    onError,
  });

  const s = summary.data;
  const addedCount = s?.people.filter((p) => p.status === "added").length ?? 0;
  const inputId = `seat-add-${requestId}`;
  const emails = parseEmails(raw);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {summary.isLoading ? <p className="text-sm text-muted-foreground">Loading</p> : null}
      {summary.error ? <p className="text-sm text-destructive">{(summary.error as Error).message}</p> : null}
      {s ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            {s.joined_total} of {s.seats} seats taken
          </p>
          {s.named === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nobody is named yet. Anyone with the attendee link can take a seat until they run out.
            </p>
          ) : null}
        </div>
      ) : null}
      {s && s.named > 0 ? (
        <ul className="flex flex-col gap-2">
          {s.people.map((p) => (
            <li key={p.email} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{p.email}</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-sm">{SEAT_STATUS_LABEL[p.status] ?? p.status}</span>
              {p.status !== "joined" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(p.email)}
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId}>Add people</Label>
        <Textarea id={inputId} rows={3} value={raw} onChange={(e) => setRaw(e.target.value)} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          disabled={emails.length === 0 || add.isPending}
          onClick={() => add.mutate(emails)}
        >
          Add
        </Button>
      </div>
      <Button
        type="button"
        size="sm"
        className="self-start"
        disabled={addedCount === 0 || send.isPending}
        onClick={() => send.mutate()}
      >
        {addedCount > 0 ? `Send invitations to ${addedCount}` : "Send invitations"}
      </Button>
    </div>
  );
}
