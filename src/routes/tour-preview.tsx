import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";

import { useTourActRenderers } from "@/components/tour/TourActs";
import { TourStage } from "@/components/tour/TourStage";
import { Button } from "@/components/ui/button";
import type { Register } from "@/lib/register";
import type { TourActId } from "@/lib/tour-content";

export const Route = createFileRoute("/tour-preview")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "First run tour preview | Lasso" },
      { name: "description", content: "A private preview of the first run Lasso tour frame." },
      { property: "og:title", content: "First run tour preview | Lasso" },
      { property: "og:description", content: "A private preview of the first run Lasso tour frame." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TourPreviewPage,
});

function TourPreviewPage() {
  const [activeAct, setActiveAct] = useState<TourActId>(1);
  const [register, setRegister] = useState<Register>("company");
  const skip = useCallback(() => setActiveAct(7), []);
  const back = useCallback(
    () => setActiveAct((current) => Math.max(1, current - 1) as TourActId),
    [],
  );
  const advance = useCallback((act: TourActId) => {
    window.setTimeout(() => setActiveAct((act + 1) as TourActId), act === 5 ? 900 : 450);
  }, []);
  const finish = useCallback(() => setActiveAct(1), []);
  const { renderers, instructionOverride, hint } = useTourActRenderers({ register, activeAct, onAdvance: advance, onHintShown: () => undefined, onFinish: finish });

  return (
    <main className="tour-preview-page">
      <div className="tour-preview-controls" aria-label="Tour preview controls">
        <label>
          Register
          <select value={register} onChange={(event) => { setRegister(event.target.value as Register); setActiveAct(1); }}>
            <option value="company">Company</option>
            <option value="partner">Partner</option>
            <option value="personal">Personal</option>
            <option value="edu">Education</option>
          </select>
        </label>
        <div aria-label="Choose act">
          {([1, 2, 3, 4, 5, 6, 7] as const satisfies readonly TourActId[]).map((act) => (
            <Button key={act} type="button" size="icon" variant={activeAct === act ? "ink" : "outline"} aria-label={`Show act ${act}`} onClick={() => setActiveAct(act)}>{act}</Button>
          ))}
        </div>
      </div>
      <TourStage
        register={register}
        activeAct={activeAct}
        acts={renderers}
        onSkip={skip}
        onBack={back}
        onHintShown={hint}
        instructionOverride={instructionOverride}
      />
    </main>
  );
}