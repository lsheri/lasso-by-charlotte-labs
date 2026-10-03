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
import { useProfile } from "@/hooks/use-profile";
import type { Database } from "@/integrations/supabase/types";

type KeyRequest = Database["public"]["Tables"]["key_requests"]["Row"];
type KeyRequestInsert = Database["public"]["Tables"]["key_requests"]["Insert"];
type Kind = "company" | "edu" | "personal";

const ORIGIN = "https://lasso.charlotte-labs.com";

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

export function attendeeLink(code: string, register?: string): string {
  const url = `${ORIGIN}/j/${code}`;
  // Unit 20: the key's own register rides in the link so signed out
  // recipients land on the right door without a lookup.
  return register ? `${url}?r=${encodeURIComponent(register)}` : url;
}

export { adminLink } from "@/lib/join-link";
import { adminLink } from "@/lib/join-link";

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

      <section>
        <SectionHeader title="Your requests" />
        <div className="mt-4 flex flex-col gap-3">
          {list.isLoading ? <p className="text-base text-muted-foreground">Loading</p> : null}
          {list.error ? <p className="text-base text-destructive">Could not load your requests.</p> : null}
          {list.data && list.data.length === 0 ? (
            <p className="text-base text-muted-foreground">No requests yet.</p>
          ) : null}
          {list.data?.map((r) => <RequestRow key={r.id} r={r} />)}
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

function RequestRow({ r }: { r: KeyRequest }) {
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
        </div>
      ) : null}
    </ToneCard>
  );
}
