/**
 * S1: the creation moment, said in plain words before anything is made.
 *
 * The sentence is not a banner: it is the sentence sitting where the person
 * reads it before clicking. The raw link appears once, right after it is made,
 * and never again, because nothing keeps it.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createBoardShareLinkFn,
  expireBoardShareLinkFn,
  listBoardShareLinksFn,
} from "@/lib/board-share.functions";
import {
  shareExposureSentence,
  shareLinkLive,
  shareLinkNotes,
  shareLinkUrl,
  shareTimeLeftLabel,
  type BoardShareLinkDto,
} from "@/lib/board-share-shared";

export function BoardLinkSection({
  engagementId,
  profileId,
  open,
}: {
  engagementId: string;
  profileId: string | undefined;
  open: boolean;
}) {
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const list = useServerFn(listBoardShareLinksFn);
  const create = useServerFn(createBoardShareLinkFn);
  const expire = useServerFn(expireBoardShareLinkFn);
  const key = ["board-share-links", engagementId, profileId ?? ""] as const;

  const links = useQuery({
    queryKey: key,
    queryFn: () =>
      list({ data: { engagement_id: engagementId, ...(profileId ? { profile_id: profileId } : {}) } }),
    enabled: open && !!engagementId,
    staleTime: 5_000,
  });

  const createLink = useMutation({
    mutationFn: () =>
      create({ data: { engagement_id: engagementId, ...(profileId ? { profile_id: profileId } : {}) } }),
    onSuccess: async (answer) => {
      if (answer.status !== "created") {
        setProblem("That link could not be made. Try again in a moment.");
        return;
      }
      setProblem(null);
      setCopied(false);
      setFreshUrl(shareLinkUrl(window.location.origin, answer.token));
      await queryClient.invalidateQueries({ queryKey: key });
    },
    onError: () => setProblem("That link could not be made. Try again in a moment."),
  });

  const expireLink = useMutation({
    mutationFn: (linkId: string) =>
      expire({ data: { link_id: linkId, ...(profileId ? { profile_id: profileId } : {}) } }),
    onSuccess: async () => {
      setFreshUrl(null);
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const holdsOthersWork = links.data?.holdsOthersWork ?? false;
  const live = (links.data?.links ?? []).filter((link) => shareLinkLive(link));

  return (
    <section className="flex flex-col gap-3">
        <p className="nb-type-small text-muted">{shareExposureSentence(holdsOthersWork)}</p>

        <ul className="space-y-1 nb-type-small text-muted">
          {shareLinkNotes().map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>

        {freshUrl ? (
          <div className="space-y-2">
            <p className="nb-type-small text-muted">
              Copy it now. This is the only time it is shown.
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={freshUrl} aria-label="The link to this board" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard?.writeText(freshUrl).then(() => setCopied(true));
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => createLink.mutate()}
            disabled={createLink.isPending}
            className="self-start"
          >
            {createLink.isPending ? "Making a link" : "Make a link"}
          </Button>
        )}

        {problem ? <p className="nb-type-small text-foreground">{problem}</p> : null}

        <div className="space-y-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">Live links</p>
          {live.length === 0 ? (
            <p className="nb-type-small text-muted">No link to this board is open right now.</p>
          ) : (
            <ul className="space-y-2">
              {live.map((link) => (
                <LiveLinkRow
                  key={link.id}
                  link={link}
                  busy={expireLink.isPending}
                  onExpire={() => expireLink.mutate(link.id)}
                />
              ))}
            </ul>
          )}
        </div>
    </section>
  );
}

function LiveLinkRow({
  link,
  busy,
  onExpire,
}: {
  link: BoardShareLinkDto;
  busy: boolean;
  onExpire: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border p-2">
      <span className="nb-type-small text-muted">
        {shareTimeLeftLabel(link.expiresAt)}
        {link.openedCount > 0
          ? ` · opened ${link.openedCount} ${link.openedCount === 1 ? "time" : "times"}`
          : " · not opened yet"}
      </span>
      <Button size="sm" variant="ghost" onClick={onExpire} disabled={busy}>
        Expire this link now
      </Button>
    </li>
  );
}
