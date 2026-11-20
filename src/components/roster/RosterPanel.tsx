import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { tagVariants } from "@/components/ui/tag";
import {
  checkRosterContact,
  checkRosterDetails,
  filterRoster,
  ROSTER_COPY as COPY,
  ROSTER_SEARCH_FROM,
  type RosterChangeResult,
  type RosterContact,
  type RosterList,
  type RosterProblem,
  type RosterSaveInput,
  type RosterSaveResult,
} from "@/lib/roster-shared";
import { askNewNumberFn, listRosterFn, saveRosterContactFn } from "@/lib/roster.functions";

/**
 * 19 Nov 2026, Proposal Desk: the roster, "People we work with". People a firm brings in on proposals who have no
 * login. The server decides who sees it: an admin or a lead of a company workspace. Anyone else gets nothing here.
 * A row shows a name, a role, where they work, how to reach them and one word for their text agreement.
 * An admin or lead types a mobile number, an email and, if they like, a LinkedIn address when adding someone. After
 * that the number comes back masked to its last four digits and is never shown in full again. It is contact
 * information only: the number texts go to is the one the person types themselves on the public /texts page,
 * reached by the link this panel copies. Copying a link sends nothing.
 *
 * For the redraw: the add and edit form is RosterDialog at the foot of this file. Its markup is plain on purpose
 * (Label, Input, NativeSelect, one hint or problem line under each field) so it can be restyled in one place.
 */
export function RosterPanel({ profileId }: { profileId: string | null | undefined }) {
  const load = useServerFn(listRosterFn);
  const save = useServerFn(saveRosterContactFn);
  const askNewNumber = useServerFn(askNewNumberFn);
  return (
    <RosterView
      profileId={profileId ?? null}
      load={(id) => load({ data: { profile_id: id } })}
      save={(input) => save({ data: input })}
      askNewNumber={(id, contactId) => askNewNumber({ data: { profile_id: id, id: contactId } })}
      copyText={(text) => navigator.clipboard.writeText(text)}
      origin={typeof window === "undefined" ? "" : window.location.origin}
    />
  );
}

export type RosterViewProps = {
  profileId: string | null;
  load: (profileId: string | null) => Promise<RosterList>;
  save: (input: RosterSaveInput) => Promise<RosterSaveResult>;
  /** Opens the window in which this person's link takes one new number. No number passes through here. */
  askNewNumber: (profileId: string | null, contactId: string) => Promise<RosterChangeResult>;
  copyText: (text: string) => Promise<void>;
  /** The site's address, put in front of each person's link. */
  origin: string;
};

type Loaded =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "hidden" }
  | { state: "ready"; contacts: RosterContact[] };
type Editing = { contact: RosterContact | null } | null;
/** The line under one row after a press: what happened, in words, and the link when it could not be copied. */
type Note = { id: string; tone: "status" | "alert"; text: string; showLink: boolean } | null;

const byName = (a: RosterContact, b: RosterContact) => a.name.localeCompare(b.name);

/** Props in, effects out, so the tests can drive it without a server. */
export function RosterView({
  profileId,
  load,
  save,
  askNewNumber,
  copyText,
  origin,
}: RosterViewProps) {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [editing, setEditing] = useState<Editing>(null);
  const [note, setNote] = useState<Note>(null);
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    setLoaded({ state: "loading" });
    setEditing(null);
    setNote(null);
    setQuery("");
    setAsking(null);
    Promise.resolve()
      .then(() => load(profileId))
      .then((list) => {
        if (current)
          setLoaded(
            list.allowed
              ? { state: "ready", contacts: [...list.contacts].sort(byName) }
              : { state: "hidden" },
          );
      })
      .catch(() => {
        if (current) setLoaded({ state: "failed" });
      });
    return () => {
      current = false;
    };
    // `load` is a new function each render; the profile and the retry count are what a reload depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, attempt]);

  const put = useCallback((contact: RosterContact) => {
    setLoaded((now) =>
      now.state === "ready"
        ? {
            state: "ready",
            contacts: [...now.contacts.filter((c) => c.id !== contact.id), contact].sort(byName),
          }
        : now,
    );
  }, []);
  const saved = useCallback(
    (contact: RosterContact) => {
      put(contact);
      setEditing(null);
    },
    [put],
  );

  if (loaded.state === "hidden") return null;

  async function copy(contact: RosterContact) {
    try {
      await copyText(origin + contact.linkPath);
      setNote({ id: contact.id, tone: "status", text: COPY.copied, showLink: false });
    } catch {
      setNote({ id: contact.id, tone: "alert", text: COPY.copyFailed, showLink: true });
    }
  }

  async function askForNewNumber(contact: RosterContact) {
    if (asking) return;
    setAsking(contact.id);
    setNote(null);
    const startedFor = profileId;
    let result: RosterChangeResult | "error";
    try {
      result = await askNewNumber(profileId, contact.id);
    } catch {
      result = "error";
    }
    // The person switched workspace or left while this was out: say nothing on the wrong list.
    if (!live.current || startedFor !== profileId) return;
    setAsking(null);
    if (result === "error")
      return setNote({
        id: contact.id,
        tone: "alert",
        text: COPY.changeFailures.unavailable,
        showLink: false,
      });
    if (!result.ok)
      return setNote({
        id: contact.id,
        tone: "alert",
        text: COPY.changeFailures[result.reason],
        showLink: false,
      });
    put(result.contact);
    const until = result.contact.changeUntil ?? "";
    try {
      await copyText(origin + result.contact.linkPath);
      setNote({ id: contact.id, tone: "status", text: COPY.newNumberDone(until), showLink: false });
    } catch {
      setNote({ id: contact.id, tone: "alert", text: COPY.newNumberNoCopy(until), showLink: true });
    }
  }

  const all = loaded.state === "ready" ? loaded.contacts : [];
  const shown = filterRoster(all, query);
  const searchable = all.length >= ROSTER_SEARCH_FROM;

  return (
    <section aria-labelledby="roster-heading" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h2 id="roster-heading" className="text-lg font-medium">
            {COPY.heading}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{COPY.intro}</p>
        </div>
        {loaded.state === "ready" ? (
          <Button type="button" onClick={() => setEditing({ contact: null })}>
            {COPY.add}
          </Button>
        ) : null}
      </div>

      {loaded.state === "loading" ? (
        <p role="status" className="text-sm text-muted-foreground">
          {COPY.loading}
        </p>
      ) : null}

      {loaded.state === "failed" ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span>{COPY.loadFailed}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {COPY.retry}
          </Button>
        </div>
      ) : null}

      {loaded.state === "ready" && all.length === 0 ? (
        <p className="text-sm text-muted-foreground">{COPY.empty}</p>
      ) : null}

      {all.length > 0 ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          {searchable ? (
            <div className="w-full max-w-xs space-y-1">
              <Label htmlFor="roster-search">{COPY.search}</Label>
              <Input
                id="roster-search"
                type="search"
                value={query}
                placeholder={COPY.searchHint}
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          ) : null}
          <p aria-live="polite" className="text-(length:--type-label) text-muted-foreground">
            {COPY.count(shown.length, all.length, all.filter((c) => c.texts === "agreed").length)}
          </p>
        </div>
      ) : null}

      {all.some((c) => c.needsDetails) ? (
        <p className="text-sm text-muted-foreground">
          {COPY.needsDetailsCount(all.filter((c) => c.needsDetails).length)}
        </p>
      ) : null}

      {all.length > 0 && shown.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{COPY.noMatch}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => setQuery("")}>
            {COPY.clearSearch}
          </Button>
        </div>
      ) : null}

      {shown.length > 0 ? (
        <ul className="divide-y divide-border rounded-[var(--radius-control)] border border-border">
          {shown.map((contact) => (
            <li key={contact.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium break-words">{contact.name}</p>
                  <p className="text-sm break-words text-muted-foreground">
                    {[
                      contact.role,
                      contact.affiliation === "firm" ? contact.firm : COPY.independent,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {contact.phoneMasked || contact.email || contact.linkedin ? (
                    <p className="ph-no-capture text-sm [overflow-wrap:anywhere] text-muted-foreground">
                      {[
                        contact.phoneMasked ? COPY.phoneOnFile(contact.phoneMasked) : null,
                        contact.email,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {contact.linkedin ? (
                        <>
                          {contact.phoneMasked || contact.email ? " · " : null}
                          <a
                            href={contact.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={COPY.linkedinLabel(contact.name)}
                            className="underline underline-offset-2"
                          >
                            {COPY.linkedin}
                          </a>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  <p className="mt-2 flex flex-wrap items-center gap-2">
                    {contact.needsDetails ? (
                      <span className={tagVariants({ tone: "neutral" })}>{COPY.needsDetails}</span>
                    ) : null}
                    <span
                      className={tagVariants({
                        tone: contact.texts === "agreed" ? "accent" : "neutral",
                      })}
                    >
                      {COPY.texts[contact.texts]}
                    </span>
                    <span className="text-(length:--type-label) text-muted-foreground">
                      {[
                        contact.texts === "agreed" && contact.agreedOn
                          ? COPY.agreedOn(contact.agreedOn)
                          : null,
                        contact.texts === "agreed"
                          ? contact.confirmed
                            ? COPY.confirmed
                            : COPY.notConfirmed
                          : null,
                        contact.texts === "stopped" && contact.stoppedOn
                          ? COPY.stoppedOn(contact.stoppedOn)
                          : null,
                        contact.changeUntil ? COPY.changeOpen(contact.changeUntil) : null,
                        contact.numberDiffers ? COPY.numberDiffers : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={COPY.copyLabel(contact.name)}
                    onClick={() => void copy(contact)}
                  >
                    {COPY.copy}
                  </Button>
                  {contact.texts === "agreed" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={asking !== null}
                      aria-label={COPY.newNumberLabel(contact.name)}
                      onClick={() => void askForNewNumber(contact)}
                    >
                      {COPY.newNumber}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={COPY.editLabel(contact.name)}
                    onClick={() => setEditing({ contact })}
                  >
                    {COPY.edit}
                  </Button>
                </div>
              </div>
              {note?.id === contact.id ? (
                <div className="space-y-1">
                  <p
                    role={note.tone}
                    className={note.tone === "alert" ? "text-sm" : "text-sm text-muted-foreground"}
                  >
                    {note.text}
                  </p>
                  {note.showLink ? (
                    <Input
                      readOnly
                      aria-label={COPY.linkLabel(contact.name)}
                      value={origin + contact.linkPath}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {editing ? (
        <RosterDialog
          key={editing.contact?.id ?? "new"}
          profileId={profileId}
          contact={editing.contact}
          save={save}
          onSaved={saved}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}

function RosterDialog({
  profileId,
  contact,
  save,
  onSaved,
  onClose,
}: {
  profileId: string | null;
  contact: RosterContact | null;
  save: RosterViewProps["save"];
  onSaved: (contact: RosterContact) => void;
  onClose: () => void;
}) {
  const D = COPY.dialog;
  const [name, setName] = useState(contact?.name ?? "");
  const [role, setRole] = useState(contact?.role ?? "");
  const [affiliation, setAffiliation] = useState<string>(contact?.affiliation ?? "independent");
  const [firm, setFirm] = useState(contact?.firm ?? "");
  // The number is never sent back in full, so its box always starts empty.
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [linkedin, setLinkedin] = useState(contact?.linkedin ?? "");
  const hasDetails = Boolean(contact && !contact.needsDetails && contact.email);
  const [problems, setProblems] = useState<RosterProblem[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const clear = (problem: RosterProblem) => setProblems((now) => now.filter((p) => p !== problem));
  const has = (problem: RosterProblem) => problems.includes(problem);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const fields = { name, role, affiliation, firm, phone, email, linkedin };
    const check = checkRosterContact(fields);
    const details = checkRosterDetails(fields, { adding: !contact, hasDetails });
    if (!check.ok || !details.ok) {
      setProblems([...(check.ok ? [] : check.problems), ...(details.ok ? [] : details.problems)]);
      setFailure(null);
      return;
    }
    lock.current = true;
    setBusy(true);
    setProblems([]);
    setFailure(null);
    let result: RosterSaveResult | "forbidden" | "error";
    try {
      result = await save({ profile_id: profileId, id: contact?.id ?? null, ...fields });
    } catch (error) {
      result = error instanceof Response && error.status === 403 ? "forbidden" : "error";
    }
    lock.current = false;
    // A dialog closed while its save was out does nothing more; the list reloads when the panel is next opened.
    if (!live.current) return;
    setBusy(false);
    if (result === "forbidden") return setFailure(COPY.failures.forbidden);
    if (result === "error") return setFailure(COPY.failures.unavailable);
    if (result.ok) return onSaved(result.contact);
    if (result.reason === "invalid") setProblems(result.problems);
    setFailure(COPY.failures[result.reason]);
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact ? D.editTitle : D.addTitle}</DialogTitle>
          <DialogDescription>{contact ? D.editDescription : D.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="roster-name">{D.name}</Label>
            <Input
              id="roster-name"
              value={name}
              autoComplete="off"
              aria-invalid={has("name")}
              aria-describedby={has("name") ? "roster-name-problem" : undefined}
              onChange={(event) => {
                setName(event.target.value);
                clear("name");
              }}
            />
            {has("name") ? (
              <p id="roster-name-problem" className="text-sm text-destructive">
                {COPY.problems.name}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="roster-role">{D.role}</Label>
            <Input
              id="roster-role"
              value={role}
              autoComplete="off"
              aria-invalid={has("role")}
              aria-describedby={has("role") ? "roster-role-problem" : "roster-role-hint"}
              onChange={(event) => {
                setRole(event.target.value);
                clear("role");
              }}
            />
            {has("role") ? (
              <p id="roster-role-problem" className="text-sm text-destructive">
                {COPY.problems.role}
              </p>
            ) : (
              <p id="roster-role-hint" className="text-(length:--type-label) text-muted-foreground">
                {D.roleHint}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="roster-affiliation">{D.affiliation}</Label>
            <NativeSelect
              id="roster-affiliation"
              value={affiliation}
              aria-invalid={has("affiliation")}
              onChange={(event) => {
                setAffiliation(event.target.value);
                clear("affiliation");
                clear("firm");
              }}
            >
              <option value="independent">{D.affiliationIndependent}</option>
              <option value="firm">{D.affiliationFirm}</option>
            </NativeSelect>
            {has("affiliation") ? (
              <p className="text-sm text-destructive">{COPY.problems.affiliation}</p>
            ) : null}
          </div>
          {affiliation === "firm" ? (
            <div className="space-y-1">
              <Label htmlFor="roster-firm">{D.firm}</Label>
              <Input
                id="roster-firm"
                value={firm}
                autoComplete="off"
                aria-invalid={has("firm")}
                aria-describedby={has("firm") ? "roster-firm-problem" : undefined}
                onChange={(event) => {
                  setFirm(event.target.value);
                  clear("firm");
                }}
              />
              {has("firm") ? (
                <p id="roster-firm-problem" className="text-sm text-destructive">
                  {COPY.problems.firm}
                </p>
              ) : null}
            </div>
          ) : null}
          {contact?.needsDetails ? (
            <p className="text-sm text-muted-foreground">{D.legacy}</p>
          ) : null}
          <div className="ph-no-capture space-y-1">
            <Label htmlFor="roster-phone">{D.phone}</Label>
            <Input
              id="roster-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              autoComplete="off"
              aria-invalid={has("phone") || has("details")}
              aria-describedby={has("phone") ? "roster-phone-problem" : "roster-phone-hint"}
              onChange={(event) => {
                setPhone(event.target.value);
                clear("phone");
                clear("details");
              }}
            />
            {has("phone") ? (
              <p id="roster-phone-problem" className="text-sm text-destructive">
                {COPY.problems.phone}
              </p>
            ) : (
              <p
                id="roster-phone-hint"
                className="text-(length:--type-label) text-muted-foreground"
              >
                {hasDetails && contact?.phoneMasked
                  ? D.phoneKeep(contact.phoneMasked)
                  : D.phoneHint}
              </p>
            )}
          </div>
          <div className="ph-no-capture space-y-1">
            <Label htmlFor="roster-email">{D.email}</Label>
            <Input
              id="roster-email"
              type="email"
              inputMode="email"
              value={email}
              autoComplete="off"
              aria-invalid={has("email") || has("details")}
              aria-describedby={has("email") ? "roster-email-problem" : "roster-email-hint"}
              onChange={(event) => {
                setEmail(event.target.value);
                clear("email");
                clear("details");
              }}
            />
            {has("email") ? (
              <p id="roster-email-problem" className="text-sm text-destructive">
                {COPY.problems.email}
              </p>
            ) : (
              <p
                id="roster-email-hint"
                className="text-(length:--type-label) text-muted-foreground"
              >
                {D.emailHint}
              </p>
            )}
          </div>
          <div className="ph-no-capture space-y-1">
            <Label htmlFor="roster-linkedin">{D.linkedin}</Label>
            <Input
              id="roster-linkedin"
              type="url"
              inputMode="url"
              value={linkedin}
              autoComplete="off"
              aria-invalid={has("linkedin")}
              aria-describedby={
                has("linkedin") ? "roster-linkedin-problem" : "roster-linkedin-hint"
              }
              onChange={(event) => {
                setLinkedin(event.target.value);
                clear("linkedin");
              }}
            />
            {has("linkedin") ? (
              <p id="roster-linkedin-problem" className="text-sm text-destructive">
                {COPY.problems.linkedin}
              </p>
            ) : (
              <p
                id="roster-linkedin-hint"
                className="text-(length:--type-label) text-muted-foreground"
              >
                {D.linkedinHint}
              </p>
            )}
          </div>
          {has("details") ? (
            <p role="alert" className="text-sm text-destructive">
              {COPY.problems.details}
            </p>
          ) : null}
          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {D.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? D.saving : D.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
