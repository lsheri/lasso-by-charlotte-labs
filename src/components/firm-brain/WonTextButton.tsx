import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { WON_TEXT_COPY, type WonTextStatus } from "@/lib/won-text-shared";
import { sendWonText, wonTextStatus } from "@/lib/won-text.functions";

/**
 * 19 Nov, Proposal Desk, first live slice (Liam, D-37 and D-39): "Text the lead" under a won proposal's outcome. The
 * server decides whether it shows at all: an admin, in a workspace whose lead agreed to be texted, on a won board.
 * Anyone else gets nothing here, and a failed read also shows nothing. The admin reads the exact words before
 * sending. While no approved number is connected (Liam, D-40) the words still show, Send answers that nothing was
 * sent, and the sent line never appears: it shows only when the server says the text was accepted. No phone number
 * is ever on this page.
 */
export function WonTextButton({ engagementId, profileId }: { engagementId: string; profileId: string | null | undefined }) {
  const load = useServerFn(wonTextStatus);
  const send = useServerFn(sendWonText);
  const [status, setStatus] = useState<WonTextStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // One id per opened preview: a second click, or a retry after a lost reply, is the same press and sends once.
  const pressId = useRef<string>("");
  const lock = useRef(false);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    setStatus(null);
    setOpen(false);
    setSent(false);
    setProblem(null);
    Promise.resolve()
      .then(() => load({ data: { engagement_id: engagementId, profile_id: profileId ?? null } }))
      .then((next) => {
        if (current) setStatus(next);
      })
      .catch(() => {
        if (current) setStatus({ show: false });
      });
    return () => {
      current = false;
    };
  }, [engagementId, profileId, load]);

  if (!status || !status.show) return null;

  function openPreview() {
    pressId.current = crypto.randomUUID();
    setProblem(null);
    setSent(false);
    setOpen(true);
  }

  async function press() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const result = await send({ data: { engagement_id: engagementId, profile_id: profileId ?? null, press_id: pressId.current } });
      if (!live.current) return;
      if (result.ok) {
        setSent(true);
        setOpen(false);
      } else {
        setProblem(result.problem);
      }
    } catch {
      if (live.current) setProblem(WON_TEXT_COPY.failed);
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }

  return (
    <div data-won-text className="mt-1 flex flex-col gap-1 text-(length:--type-small)">
      {sent ? (
        <p data-won-text-sent role="status" className="text-foreground">
          {WON_TEXT_COPY.sent}
        </p>
      ) : null}
      {open ? (
        <div data-won-text-preview className="flex flex-col gap-2">
          <p className="text-muted-foreground">{WON_TEXT_COPY.title}</p>
          <p data-won-text-words className="max-w-[32ch] self-start rounded-[var(--radius)] bg-muted px-3 py-2 text-foreground">
            {status.preview}
          </p>
          <p className="max-w-[40ch] text-muted-foreground">{status.connected ? WON_TEXT_COPY.helper : status.needsNumber ? WON_TEXT_COPY.noNumber : WON_TEXT_COPY.awaiting}</p>
          {problem ? (
            <p role="alert" className="max-w-[40ch] text-destructive">
              {problem}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void press()}>
              {busy ? WON_TEXT_COPY.sending : WON_TEXT_COPY.send}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              {WON_TEXT_COPY.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" className="self-start" onClick={openPreview}>
          {WON_TEXT_COPY.open}
        </Button>
      )}
    </div>
  );
}
