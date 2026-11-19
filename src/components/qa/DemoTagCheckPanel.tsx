import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { checkDemoTagFn } from "@/lib/demo-firm.functions";
import { scoreTagCheck, tagCheckLines, type TagCheckResult } from "@/lib/tag-check-shared";

export const TAG_CHECK_COPY = {
  title: "Firm brain tag check",
  line: "Runs the card call on 46 seeded demo items, once as it is today and once with the firm brain tags, and compares the tags with the seed's own labels. About 92 fast calls. Read only: nothing is written to any item.",
  run: "Run the tag check",
  running: "Checking…",
  stopped: "Stopped",
} as const;

/** Founder-only, on the QA seed page: the step 5 check that needs a real model, one item per call. */
export function DemoTagCheckPanel({ profileId }: { profileId: string | undefined }) {
  const check = useServerFn(checkDemoTagFn);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const running = useRef(false);

  async function run() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setLines([]);
    const results: TagCheckResult[] = [];
    let names: string[] = [];
    try {
      for (let index = 0; ; index += 1) {
        const answer = await check({ data: { profile_id: profileId, index } });
        names = answer.names;
        if (!answer.result) break;
        results.push(answer.result);
        setProgress(`${results.length} of ${answer.total}`);
      }
      setLines(tagCheckLines(scoreTagCheck(results, names), results));
    } catch (error) {
      setLines([
        `${TAG_CHECK_COPY.stopped} after ${results.length} items: ${error instanceof Error ? error.message : String(error)}`,
        ...(results.length ? tagCheckLines(scoreTagCheck(results, names), results) : []),
      ]);
    } finally {
      running.current = false;
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <section className="space-y-3 border-t pt-6" aria-labelledby="tag-check-title">
      <h2 id="tag-check-title" className="text-lg font-semibold">
        {TAG_CHECK_COPY.title}
      </h2>
      <p className="text-sm text-muted-foreground">{TAG_CHECK_COPY.line}</p>
      <Button type="button" variant="outline" onClick={() => void run()} disabled={busy}>
        {busy ? `${TAG_CHECK_COPY.running} ${progress ?? ""}` : TAG_CHECK_COPY.run}
      </Button>
      {lines.length ? (
        <pre className="whitespace-pre-wrap font-mono text-xs text-foreground" data-testid="tag-check-report">
          {lines.join("\n")}
        </pre>
      ) : null}
    </section>
  );
}
