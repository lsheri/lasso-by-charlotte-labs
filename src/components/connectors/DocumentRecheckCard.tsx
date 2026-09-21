import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { useProfile } from "@/hooks/use-profile";
import { getDocumentRecheck, setDocumentRecheck } from "@/lib/document-recheck.functions";

/** The per-account switch for re-reading connected documents. */
export function DocumentRecheckCard() {
  const { data: profile } = useProfile();
  const read = useServerFn(getDocumentRecheck);
  const write = useServerFn(setDocumentRecheck);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["document-recheck-setting", profile?.id],
    queryFn: () => read({ data: { profile_id: profile?.id } }),
    enabled: Boolean(profile?.id),
  });

  if (!data?.connected) return null;

  async function toggle(next: boolean) {
    try {
      await write({ data: { profile_id: profile?.id, enabled: next } });
      await queryClient.invalidateQueries({ queryKey: ["document-recheck-setting"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <label className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-card px-4 py-3">
      <Checkbox
        checked={data.enabled}
        onCheckedChange={(next) => void toggle(next === true)}
        className="mt-0.5"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-foreground">
          Let Lasso check connected documents for new versions
        </span>
        <span className="mt-0.5 block nb-type-small leading-[17px] text-muted-foreground">
          Off by default. Lasso only reads a connected document when you ask it to. Turn this on and
          it will also check on its own, re-reading a document only when its source says it changed.
        </span>
      </span>
    </label>
  );
}
