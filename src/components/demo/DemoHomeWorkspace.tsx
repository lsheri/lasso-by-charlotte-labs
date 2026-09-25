import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { DemoTourNote } from "@/components/demo/DemoTourNote";
import { HomeEngagementGrid } from "@/components/home/HomeEngagementGrid";
import { useDemoTour } from "@/hooks/use-demo-tour";
import { openDemoHomeFn } from "@/lib/demo.functions";
import { noteDemoOpened } from "@/lib/demo-telemetry";
import type { HomePreviewState } from "@/lib/home-board-preview";
import type { HomeGridEngagement } from "@/lib/home-grid";

type DemoHomeSurface = "home" | "landing";

export function useDemoHomeOpened(surface: DemoHomeSurface, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (surface === "home") {
      noteDemoOpened("home", "none");
      return;
    }
    const section = ref.current;
    if (!section || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      noteDemoOpened("landing", "none");
      observer.disconnect();
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, [ref, surface]);
}

export function DemoHomeWorkspace({ surface }: { surface: DemoHomeSurface }) {
  const open = useServerFn(openDemoHomeFn);
  const query = useQuery({ queryKey: ["demo-home"], queryFn: () => open(), staleTime: 60_000 });
  const sectionRef = useRef<HTMLElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(960);
  const tour = useDemoTour();

  useDemoHomeOpened(surface, sectionRef);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { cards, previews } = useMemo(() => {
    const list = query.data?.engagements ?? [];
    const cards: HomeGridEngagement[] = list.map((engagement) => ({
      id: engagement.code,
      code: engagement.code,
      title: engagement.title,
      clientLabel: engagement.clientLabel,
      lastViewedAt: null,
      workCount: engagement.workCount,
    }));
    const previews = new Map<string, HomePreviewState>(
      list.map((engagement) => [engagement.code, { status: "ready", board: engagement.preview }]),
    );
    return { cards, previews };
  }, [query.data]);

  return (
    <section ref={sectionRef} aria-label="Demo engagements">
      <div ref={gridRef} className={tour.step === 1 ? "pt-28" : undefined}>
        {query.isPending ? (
          <p className="text-[13px] text-muted-foreground">Opening the demo.</p>
        ) : cards.length === 0 ? (
          <p className="text-[13px] text-foreground">The demo is not available right now.</p>
        ) : (
          <HomeEngagementGrid
            cards={cards}
            availableWidth={width}
            previews={previews}
            demo
            onDemoOpen={(code) => { if (code === "YSM-01") tour.complete(1, "home"); }}
          />
        )}
      </div>
      {tour.step === 1 && cards.some((card) => card.code === "YSM-01") ? (
        <DemoTourNote step={1} anchorTestId="demo-engagement-YSM-01" onDismiss={tour.dismiss}>
          Start here: the CFO asked where a number came from.
        </DemoTourNote>
      ) : null}
    </section>
  );
}