import { useState, type ReactNode } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ToneCard } from "@/components/notebook/ToneCard";
import { NotebookSpider } from "@/components/notebook/NotebookSpider";
import { SpiderLassoScene } from "@/components/motion/SpiderLassoScene";
import { MOTION_SCENES, type MotionScene } from "@/lib/motion-scenes";
import { Button } from "@/components/ui/button";

/**
 * Internal review page for the animated scenes in MOTION_SCENES.
 * Reached by typing /motion; nothing links to it. Deliberately no telemetry.
 */

export const SCENE_VIEWS: Record<string, () => ReactNode> = {
  "m6-spider-lasso": () => <SpiderLassoScene />,
  "m10-notebook-spider": () => <NotebookSpider size={180} reading />,
};

function formatLoop(scene: MotionScene): string {
  const loop = scene.loop === "loop-with-pause" ? "loop with pause" : scene.loop;
  const pause = scene.pauseMs != null ? ` · holds ${scene.pauseMs / 1000}s` : "";
  return `${scene.durationMs / 1000}s · ${loop}${pause}`;
}

function SceneCard({ scene }: { scene: MotionScene }) {
  const [replayKey, setReplayKey] = useState(0);
  const view = SCENE_VIEWS[scene.id];

  return (
    <ToneCard tone="paper" label={scene.role} className="gap-3 p-4">
      <div className="flex min-h-[120px] items-center justify-center overflow-hidden py-4">
        {view ? (
          <div key={replayKey}>{view()}</div>
        ) : (
          <p className="text-[11.5px] text-muted-foreground">
            This scene has no preview yet.
          </p>
        )}
      </div>

      <div>
        <h2 className="text-[13px] font-medium text-foreground">{scene.name}</h2>
        <p className="font-mono text-[10px] text-soft">{scene.id}</p>
      </div>

      <p className="text-[11.5px] text-muted-foreground">{scene.source}</p>
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
        {formatLoop(scene)}
      </p>

      <div>
        <p className="micro-label text-[9px]">Renders in</p>
        <ul className="mt-1 list-disc pl-4">
          {scene.placement.map((place) => (
            <li key={place} className="text-[11.5px] text-muted-foreground">
              {place}
            </li>
          ))}
        </ul>
      </div>

      {view ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReplayKey((k) => k + 1)}
          >
            Replay
          </Button>
        </div>
      ) : null}
    </ToneCard>
  );
}

export function MotionPage() {
  return (
    <div>
      <PageHeader
        title="Motion"
        subtitle="The animated scenes in the app, and where each one renders."
      />
      <div className="grid gap-4">
        {MOTION_SCENES.map((scene) => (
          <SceneCard key={scene.id} scene={scene} />
        ))}
      </div>
    </div>
  );
}
