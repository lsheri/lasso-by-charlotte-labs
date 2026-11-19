import { useState } from "react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { METHOD_LABELS, SITUATION_LABELS } from "@/lib/engagement-tags";
import { JUNIOR_COPY, type JuniorTags } from "@/lib/firm-junior-shared";
import { parseWalkTag, type WalkTag } from "@/lib/firm-walkthrough-shared";

import { FirmWalkthrough } from "./FirmWalkthrough";

export const juniorCard =
  "flex min-w-0 flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-4 shadow-card";

/**
 * "How we do this" on Home: the way in to a walk-through for people who cannot open the firm view. Pick a situation
 * or a method from the fixed lists and the walk-through opens in place. Only tags the firm has shared work for are
 * offered, and what is sent is the tag alone. Plain values in: the list is loaded by the caller.
 */
export function HowWeDoThis({
  tags,
  loading,
  failed,
  onRetry,
  profileId,
}: {
  tags: JuniorTags | null | undefined;
  loading: boolean;
  failed: boolean;
  onRetry?: () => void;
  profileId: string | null | undefined;
}) {
  const [picked, setPicked] = useState("");
  const at = picked.indexOf(":");
  const tag: WalkTag | null = at < 0 ? null : parseWalkTag(picked.slice(0, at), picked.slice(at + 1));
  const empty = Boolean(tags) && !tags!.situations.length && !tags!.methods.length;

  return (
    <section data-testid="how-we-do-this" aria-labelledby="how-we-do-this-title" className={juniorCard}>
      <div>
        <h2 id="how-we-do-this-title" className="text-(length:--type-title) font-medium text-foreground">
          {JUNIOR_COPY.walkTitle}
        </h2>
        <p className="mt-1 text-(length:--type-small) text-muted-foreground">{JUNIOR_COPY.walkHint}</p>
      </div>
      {failed ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-(length:--type-small) text-destructive">
            {JUNIOR_COPY.tagsError}
          </p>
          {onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              {JUNIOR_COPY.retry}
            </Button>
          ) : null}
        </div>
      ) : empty ? (
        <p data-walk-no-tags className="text-(length:--type-small) text-muted-foreground">
          {JUNIOR_COPY.noTags}
        </p>
      ) : (
        <NativeSelect
          data-testid="how-we-do-this-pick"
          aria-label={JUNIOR_COPY.walkLabel}
          value={picked}
          // Locked until the list has arrived.
          disabled={loading || !tags}
          onChange={(event) => setPicked(event.target.value)}
        >
          <option value="">{JUNIOR_COPY.walkPick}</option>
          {tags?.situations.length ? (
            <optgroup label={JUNIOR_COPY.situations}>
              {tags.situations.map((row) => (
                <option key={row.tag} value={`situation:${row.tag}`}>
                  {SITUATION_LABELS[row.tag]}
                </option>
              ))}
            </optgroup>
          ) : null}
          {tags?.methods.length ? (
            <optgroup label={JUNIOR_COPY.methods}>
              {tags.methods.map((row) => (
                <option key={row.tag} value={`method:${row.tag}`}>
                  {METHOD_LABELS[row.tag]}
                </option>
              ))}
            </optgroup>
          ) : null}
        </NativeSelect>
      )}
      {tag && !failed ? (
        // A new pick starts empty, and a reply for the old one is ignored.
        <FirmWalkthrough key={picked} tag={tag} profileId={profileId} autoOpen />
      ) : null}
    </section>
  );
}
