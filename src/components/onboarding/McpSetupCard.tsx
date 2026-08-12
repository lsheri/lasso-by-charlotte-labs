import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { createMcpToken, getMcpToken } from "@/lib/mcp-tokens.functions";
import { TOOLS } from "@/lib/onboarding-tools";
import { ToolBadge } from "./ToolBadge";

type McpVendor = "claude" | "chatgpt";

const STEPS: Record<McpVendor, string[]> = {
  claude: [
    "Open Claude → Settings → Connectors.",
    "Add custom connector.",
    "Paste your Lasso URL, save, and allow it when Claude asks.",
  ],
  chatgpt: [
    "Open ChatGPT → Settings → Connectors (turn on Developer mode if you don't see it).",
    "Add → custom MCP server.",
    "Paste your Lasso URL, save, and allow it when ChatGPT asks.",
  ],
};

/** Counts everything this person has ever received over MCP. */
async function countMcpItems(profileId: string): Promise<number> {
  const { count } = await supabase
    .from("work_items")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", profileId)
    .like("source", "mcp:%");
  return count ?? 0;
}

export function McpSetupCard({ vendor }: { vendor: McpVendor }) {
  const meta = TOOLS[vendor];
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const fetchToken = useServerFn(getMcpToken);
  const create = useServerFn(createMcpToken);
  const { data: token } = useQuery({
    queryKey: ["mcp-token"],
    queryFn: () => fetchToken({ data: { profile_id: profile?.id } }),
  });
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [baseline, setBaseline] = useState<number | null>(null);
  const [arrived, setArrived] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Light poll: the count of MCP-pushed items for this profile. The moment it
  // rises above where it stood when the URL appeared, the first push landed.
  useEffect(() => {
    if (!profile?.id || !url || arrived) return;
    let cancelled = false;
    void (async () => {
      const start = await countMcpItems(profile.id);
      if (cancelled) return;
      setBaseline(start);
      timer.current = setInterval(() => {
        void countMcpItems(profile.id).then(async (n) => {
          if (n > start) {
            if (timer.current) clearInterval(timer.current);
            setArrived(true);
            await queryClient.invalidateQueries({ queryKey: ["work-items"] });
          }
        });
      }, 6000);
    })();
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, [profile?.id, url, arrived, queryClient]);

  async function generate() {
    setBusy(true);
    try {
      const { token: raw } = await create({ data: { profile_id: profile?.id } });
      setUrl(`${window.location.origin}/api/mcp/${raw}`);
      await queryClient.invalidateQueries({ queryKey: ["mcp-token"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    toast.success("URL copied");
  }

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-5 py-5 shadow-card">
      <div className="flex items-start gap-3">
        <ToolBadge tool={vendor} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Connect {meta.label} to Lasso</p>
          <p className="mt-1 text-sm text-muted-foreground">
            One connector, set up once. Then you just say “push this to Lasso” at the end of a
            session — and only that lands here.
          </p>
        </div>
      </div>

      {!url ? (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Button type="button" disabled={busy} onClick={() => void generate()}>
            {busy ? "Generating…" : token ? "Generate a new URL" : "Generate my connector URL"}
          </Button>
          {token ? (
            <span className="text-xs text-muted-foreground">
              You already have one — generating replaces it.
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-[var(--radius)] border border-accent bg-accent-soft px-4 py-3">
            <p className="micro-label text-accent-deep">Your connector URL — shown once</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <code className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">
                {url}
              </code>
              <Button type="button" size="sm" onClick={() => void copy(url)}>
                Copy
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Treat it like a password. You can revoke it any time from Connectors.
            </p>
          </div>

          <ol className="space-y-1.5">
            {STEPS[vendor].map((step, index) => (
              <li key={step} className="flex gap-2 text-sm text-muted-foreground">
                <span className="font-mono text-[11px] text-accent-deep">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <div
            className={
              arrived
                ? "flex items-center gap-2 rounded-[var(--radius)] border border-accent bg-accent-soft px-4 py-3 text-sm text-accent-deep"
                : "flex items-center gap-2 rounded-[var(--radius)] border border-border bg-secondary/60 px-4 py-3 text-sm text-muted-foreground"
            }
            aria-live="polite"
          >
            {arrived ? (
              <>
                <Check size={15} />
                <span>First push landed. It&apos;s in your Work, private and unmapped.</span>
              </>
            ) : (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>
                  Waiting for your first push…{" "}
                  {baseline === null ? "" : "try saying “Push this conversation to Lasso.”"}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
