/**
 * Unit 2: "Regenerate demo answers", shown only to an admin of the demo org on
 * a demo engagement. Everyone else renders nothing. The server re-checks.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { demoAdminStatusFn, regenerateDemoPresetsFn } from "@/lib/demo.functions";

export function DemoPresetsAdmin({ engagementId }: { engagementId: string }) {
  const status = useServerFn(demoAdminStatusFn);
  const regenerate = useServerFn(regenerateDemoPresetsFn);
  const query = useQuery({
    queryKey: ["demo-admin-status", engagementId],
    queryFn: () => status({ data: { engagementId } }),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const run = useMutation({ mutationFn: () => regenerate({ data: { engagementId } }) });
  if (!query.data?.canRegenerate) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate()}>
        {run.isPending ? "Regenerating demo answers" : "Regenerate demo answers"}
      </Button>
      {run.isSuccess ? (
        <span className="text-xs text-muted-foreground">
          {run.data.answered} of {run.data.total} answers saved.
        </span>
      ) : null}
      {run.isError ? <span className="text-xs text-muted-foreground">That did not finish. Try again.</span> : null}
    </div>
  );
}
