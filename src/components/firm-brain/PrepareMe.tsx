import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { tagVariants } from "@/components/ui/tag";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/engagement-tags";
import { firmDate } from "@/lib/firm-ask-shared";
import {
  JUNIOR_COPY,
  parsePrepareRole,
  type FirmPrepareResult,
  type JuniorTags,
} from "@/lib/firm-junior-shared";
import { getFirmPrepare } from "@/lib/firm-junior.functions";

import { CiteThis } from "./CiteThis";
import { FirmSourcePreview } from "./FirmSourcePreview";
import { FirmWalkthrough } from "./FirmWalkthrough";
import { juniorCard } from "./HowWeDoThis";

/**
 * "Prepare me" on Home: pick who a call is with, as a role from the fixed list, and see what the firm asked people in
 * that role before. Calls on the person's own boards give the firm's questions word for word; other calls give what
 * was covered, from their stored summary. A role with no past calls says so and offers the general walk-through.
 * The answer lives in this component's state only. Plain values in: the list of roles is loaded by the caller.
 */
export function PrepareMe({
  tags,
  loading,
  failed,
  profileId,
}: {
  tags: JuniorTags | null | undefined;
  loading: boolean;
  failed: boolean;
  profileId: string | null | undefined;
}) {
  const load = useServerFn(getFirmPrepare);
  const [role, setRole] = useState<Role | "">("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [refused, setRefused] = useState(false);
  const [result, setResult] = useState<FirmPrepareResult | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const alive = useRef(true);
  const busy = useRef(false);
  /** Bumped when the role changes, so a reply for the role picked before is ignored. */
  const ask = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // A guest or someone outside a company workspace: the server says no, so the panel goes away.
  if (refused) return null;

  const withCalls = new Set((tags?.roles ?? []).map((row) => row.tag));
  const roles = ROLES.filter((entry) => entry !== "other");

  function pick(value: string) {
    ask.current += 1;
    busy.current = false;
    setRole(parsePrepareRole(value) ?? "");
    setResult(null);
    setError(false);
    setPending(false);
  }

  async function prepare() {
    // The ref, not the state, stops a double press: two clicks in one tick both see the old state.
    if (busy.current || !role) return;
    busy.current = true;
    const mine = ask.current;
    setPending(true);
    setError(false);
    try {
      const answer = await load({ data: { role, profile_id: profileId ?? null } });
      if (alive.current && mine === ask.current) setResult(answer);
    } catch (thrown) {
      if (!alive.current || mine !== ask.current) return;
      if (thrown instanceof Response && thrown.status === 403) setRefused(true);
      else setError(true);
    } finally {
      if (mine === ask.current) {
        busy.current = false;
        if (alive.current) setPending(false);
      }
    }
  }

  const nothing = result && (result.status === "none" || result.status === "empty");

  return (
    <section
      data-testid="prepare-me"
      data-prepare={result && !pending ? result.status : "closed"}
      aria-labelledby="prepare-me-title"
      className={juniorCard}
    >
      <div>
        <h2 id="prepare-me-title" className="text-(length:--type-title) font-medium text-foreground">
          {JUNIOR_COPY.prepareTitle}
        </h2>
        <p className="mt-1 text-(length:--type-small) text-muted-foreground">{JUNIOR_COPY.prepareHint}</p>
      </div>
      {failed ? (
        <p role="alert" className="text-(length:--type-small) text-destructive">
          {JUNIOR_COPY.tagsError}
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <NativeSelect
            data-testid="prepare-me-role"
            aria-label={JUNIOR_COPY.prepareLabel}
            value={role}
            // Locked until the list of roles has arrived.
            disabled={loading || !tags}
            onChange={(event) => pick(event.target.value)}
            className="sm:flex-1"
          >
            <option value="">{JUNIOR_COPY.preparePick}</option>
            <optgroup label={JUNIOR_COPY.withCalls}>
              {roles
                .filter((entry) => withCalls.has(entry))
                .map((entry) => (
                  <option key={entry} value={entry}>
                    {ROLE_LABELS[entry]}
                  </option>
                ))}
            </optgroup>
            <optgroup label={JUNIOR_COPY.withoutCalls}>
              {roles
                .filter((entry) => !withCalls.has(entry))
                .map((entry) => (
                  <option key={entry} value={entry}>
                    {ROLE_LABELS[entry]}
                  </option>
                ))}
            </optgroup>
          </NativeSelect>
          <Button
            type="button"
            variant="outline"
            data-testid="prepare-me-submit"
            disabled={pending || !role}
            onClick={() => void prepare()}
          >
            {JUNIOR_COPY.prepareSubmit}
          </Button>
        </div>
      )}
      {pending ? (
        <p role="status" className="flex items-center gap-2 text-(length:--type-small) text-muted-foreground">
          <span className="nb-dots" aria-hidden>
            <span className="nb-dot" />
            <span className="nb-dot" />
            <span className="nb-dot" />
          </span>
          {JUNIOR_COPY.preparePending}
        </p>
      ) : null}
      {error && !pending ? (
        <p role="alert" className="text-(length:--type-small) text-destructive">
          {JUNIOR_COPY.prepareError}
        </p>
      ) : null}

      {result && !pending ? (
        <>
          {nothing ? (
            <div data-prepare-nothing className="flex flex-col gap-3">
              <p className="text-(length:--type-body) text-foreground">
                {result.status === "none" ? JUNIOR_COPY.none(result.label) : JUNIOR_COPY.empty(result.label)}
              </p>
              <p className="text-(length:--type-small) text-muted-foreground">
                {JUNIOR_COPY.fallback(result.fallback.label)}
              </p>
              <FirmWalkthrough
                key={`fallback-${result.role}`}
                tag={{ kind: "method", tag: result.fallback.tag }}
                profileId={profileId}
              />
            </div>
          ) : (
            <ol className="flex flex-col gap-4">
              {result.entries.map((entry) => (
                <li key={entry.itemId} data-prepare-entry={entry.grade} className="flex flex-col gap-1.5">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-(length:--type-body) font-medium text-foreground">
                    <span data-prepare-engagement>{entry.engagement}</span>
                    <span data-prepare-date className="text-(length:--type-small) font-normal text-muted-foreground">
                      {firmDate(entry.date)}
                    </span>
                    <span className={tagVariants({ tone: entry.grade === "asked" ? "accent" : "outline" })}>
                      {entry.grade === "asked" ? JUNIOR_COPY.asked : JUNIOR_COPY.covered}
                    </span>
                  </p>
                  {entry.grade === "covered" ? (
                    <p className="text-(length:--type-small) text-muted-foreground">{JUNIOR_COPY.coveredNote}</p>
                  ) : null}
                  <ul className="flex flex-col gap-1.5">
                    {entry.lines.map((line) => (
                      <li key={line} className="flex flex-col gap-0.5">
                        {entry.grade === "asked" ? (
                          <blockquote
                            data-prepare-line="asked"
                            className="border-l-2 border-border pl-3 text-(length:--type-body) text-foreground"
                          >
                            {line}
                          </blockquote>
                        ) : (
                          <p data-prepare-line="covered" className="text-(length:--type-body) text-foreground">
                            {line}
                          </p>
                        )}
                        <CiteThis quote={line} sourceItemId={entry.itemId} profileId={profileId} />
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    data-prepare-source={entry.itemId}
                    className="self-start px-0"
                    onClick={() => setOpenItem(entry.itemId)}
                  >
                    {JUNIOR_COPY.openSource}
                  </Button>
                </li>
              ))}
            </ol>
          )}
          <p className="text-(length:--type-small) text-muted-foreground">{`${result.coverage} ${JUNIOR_COPY.stored}`}</p>
        </>
      ) : null}
      <FirmSourcePreview itemId={openItem} profileId={profileId} onClose={() => setOpenItem(null)} />
    </section>
  );
}
