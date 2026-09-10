import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ChaliceMark } from "@/components/notebook/marks";
import {
  AnalysisConfirm,
  type AnalysisConfirmRequest,
} from "@/components/reflect/AnalysisConfirm";
import { WorkArtifactSections } from "@/components/journey/WorkArtifactSections";
import {
  ANALYSIS_SOURCES,
  GROUNDING_LINE,
  NEVER_LINE,
  type AnalysisPreset,
} from "@/lib/analysis-presets";
import {
  BUILD_ARTIFACT_LABEL,
  BUILD_ARTIFACT_LINE,
  NO_ARTIFACT_VIEWER_LINE,
  REBUILD_ARTIFACT_LABEL,
  RUNNING_ARTIFACT_LINE,
  WORK_ARTIFACT_PRESET,
  WORK_ARTIFACT_TITLE,
} from "@/lib/work-artifact-shared";
import { getWorkArtifact, runWorkArtifactRun } from "@/lib/work-artifact.functions";

/**
 * A run preset and never a chip. This preset object exists only so the build
 * step can reuse the normal confirm dialog: it is deliberately absent from the
 * analysis registry, so no menu anywhere can offer it.
 */
export const WORK_ARTIFACT_CONFIRM_PRESET = {
  id: WORK_ARTIFACT_PRESET,
  dbPreset: WORK_ARTIFACT_PRESET,
  label: WORK_ARTIFACT_TITLE,
  description: BUILD_ARTIFACT_LINE,
  scope: "deliverable",
  systemPrompt: "",
  openingMessage: "",
  infoPanel: {
    reads: (detail: string) => `Reads ${detail}`,
    looksFor: [
      "How the models were used, stage by stage",
      "The instructions in the record that moved the work forward",
      "Where the work was checked against another source",
      "What the record cannot show",
    ],
    never: `${NEVER_LINE} ${GROUNDING_LINE}`,
    sources: ANALYSIS_SOURCES,
  },
  attribution: null,
  coachMayRun: false,
} as unknown as AnalysisPreset;

export function WorkArtifactPanel({
  anchorId,
  anchorTitle,
  canEdit,
  orgId,
  profileId,
  drawing,
  startMs,
}: {
  anchorId: string;
  anchorTitle: string;
  canEdit: boolean;
  orgId?: string | undefined;
  profileId?: string | undefined;
  drawing: boolean;
  startMs: number;
}) {
  const queryClient = useQueryClient();
  const fetchArtifact = useServerFn(getWorkArtifact);
  const runArtifact = useServerFn(runWorkArtifactRun);
  const [confirming, setConfirming] = useState<AnalysisConfirmRequest | null>(null);

  // Any click or keypress completes the reveal at once, the same skip the
  // spine already honours.
  const [skipped, setSkipped] = useState(false);
  useEffect(() => {
    if (!drawing || skipped) return;
    const done = () => setSkipped(true);
    window.addEventListener("click", done);
    window.addEventListener("keydown", done);
    return () => {
      window.removeEventListener("click", done);
      window.removeEventListener("keydown", done);
    };
  }, [drawing, skipped]);
  const revealing = drawing && !skipped;

  const stored = useQuery({
    queryKey: ["work-artifact", anchorId],
    queryFn: () => fetchArtifact({ data: { anchor_id: anchorId } }),
  });

  const build = useMutation({
    mutationFn: () => runArtifact({ data: { anchor_id: anchorId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["work-artifact", anchorId] });
    },
    onError: (error: unknown) => toast.error((error as Error).message),
  });

  function askToBuild() {
    setConfirming({
      preset: WORK_ARTIFACT_CONFIRM_PRESET,
      target: { kind: "item", id: anchorId, title: anchorTitle, scope: "deliverable" },
    });
  }

  const artifact = stored.data?.artifact ?? null;

  return (
    <div className="mt-8">
      <AnalysisConfirm
        request={confirming}
        orgId={orgId}
        profileId={profileId}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          setConfirming(null);
          build.mutate();
        }}
      />

      {build.isPending ? (
        <p className="flex items-center gap-2 rounded-[var(--radius-md)] border border-pencil bg-card px-4 py-3.5 text-sm text-muted-foreground">
          <span className="nb-dots" aria-hidden>
            <span className="nb-dot" />
            <span className="nb-dot" />
            <span className="nb-dot" />
          </span>
          {RUNNING_ARTIFACT_LINE}
        </p>
      ) : artifact ? (
        <>
          {canEdit ? (
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={askToBuild}
                className="rounded-[var(--radius-md)] border border-pencil px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {REBUILD_ARTIFACT_LABEL}
              </button>
            </div>
          ) : null}
          <WorkArtifactSections artifact={artifact} drawing={revealing} startMs={startMs} />
        </>
      ) : stored.isLoading ? null : canEdit ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-pencil px-4 py-8 text-center">
          <ChaliceMark size={28} />
          <p className="text-sm font-medium text-foreground">{BUILD_ARTIFACT_LABEL}</p>
          <p className="max-w-[42ch] text-xs text-muted-foreground">{BUILD_ARTIFACT_LINE}</p>
          <button
            type="button"
            onClick={askToBuild}
            className="mt-1 rounded-full border border-accent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            {BUILD_ARTIFACT_LABEL}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{NO_ARTIFACT_VIEWER_LINE}</p>
      )}
    </div>
  );
}
