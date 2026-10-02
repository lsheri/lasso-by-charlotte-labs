import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

import { TourStage, type TourActRenderer } from "@/components/tour/TourStage";

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
  const [activeAct, setActiveAct] = useState<1 | 2 | 3 | 4 | 5>(3);
  const acts = useMemo<readonly TourActRenderer[]>(
    () =>
      Array.from({ length: 5 }, (_, index) => ({
        content: (
          <div className="tour-preview-art" aria-hidden>
            <span />
            <span />
            <span />
            <i data-position={index + 1} />
          </div>
        ),
      })),
    [],
  );
  const skip = useCallback(() => setActiveAct(5), []);
  const back = useCallback(
    () => setActiveAct((current) => Math.max(1, current - 1) as 1 | 2 | 3 | 4 | 5),
    [],
  );
  const hint = useCallback((_act: number) => {}, []);

  return (
    <main className="tour-preview-page">
      <TourStage
        register="company"
        activeAct={activeAct}
        acts={acts}
        onSkip={skip}
        onBack={back}
        onHintShown={hint}
      />
    </main>
  );
}