import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useReducer, useState, type ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-motion";
import type { FirmAskResult } from "@/lib/firm-ask-shared";
import type { FirmGraph } from "@/lib/firm-graph-shared";
import {
  answerTrace,
  canSeeFirmMap,
  FIRM_MAP_COPY,
  INITIAL_MAP_STATE,
  layoutFirmMap,
  litNodes as litNodesOf,
  litThreads,
  mapReducer,
  readingFor,
  replayDelays as replayDelaysOf,
  selectedNode,
} from "@/lib/firm-map-shared";
import { getFirmMap } from "@/lib/firm-map.functions";
import { hasWebGL } from "@/lib/webgl-capability";

import { AskTheFirm } from "./AskTheFirm";
import type { FirmMapRendererProps } from "./firm-map-renderer";
import { FirmMapFlat } from "./FirmMapFlat";
import { FirmMapList } from "./FirmMapList";
import { FirmMapReading } from "./FirmMapReading";

type MapProfile = {
  id?: string | null;
  role?: string | null;
  has_firm_view?: boolean | null;
  org_type?: string | null;
  is_guest?: boolean | null;
};

/** Which renderer draws the map now: the list until something better is ready, the 3D map when it is, the flat map if it fails. */
type Renderer = "list" | "three" | "flat";

/**
 * Loads the 3D map only in a browser with WebGL, only by dynamic import, so three.js is never in the main bundle.
 * Until it arrives (or if there is no WebGL) the list stands in; if it fails to load or start, the flat map does.
 */
function useRenderer(): {
  renderer: Renderer;
  Three: ComponentType<FirmMapRendererProps> | null;
  fail: () => void;
} {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [Three, setThree] = useState<ComponentType<FirmMapRendererProps> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ok = hasWebGL();
    setWebgl(ok);
    if (!ok) return;
    let alive = true;
    import("./FirmMap3D")
      .then((module) => {
        if (alive) setThree(() => module.default);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const renderer: Renderer = !webgl ? "list" : failed ? "flat" : Three ? "three" : "list";
  return { renderer, Three, fail: () => setFailed(true) };
}

/**
 * The map's stage. The map is about as tall as it is wide, so on a phone the stage is capped near the stage's own
 * width (115vw): at 70vh the lower half of a phone stage was empty. From a tablet up the cap never applies.
 */
export const FIRM_MAP_STAGE_CLASS =
  "relative h-[min(70vh,620px,115vw)] min-h-[360px] min-w-0 overflow-hidden rounded-[var(--radius)] border border-border bg-(--surface-raised)";

/**
 * 18 Nov, Firm Brain Build Spec steps 3 and 4: the firm brain map at the top of the firm view, with Ask the firm
 * beside it. Hidden unless the workspace is a company and the person is neither a coach nor a
 * guest; the server checks again. Only on the signed-in firm view: never on shared, demo, tour or rollup surfaces.
 * Where it cannot show, Ask the firm keeps its own rules.
 */
export function FirmBrainMap({ profile }: { profile: MapProfile | null | undefined }) {
  const askClass = "rounded-[var(--radius)] border border-border bg-card p-4 shadow-card";
  if (!canSeeFirmMap(profile)) return <AskTheFirm profile={profile} className={askClass} />;
  return <FirmBrainMapView profile={profile!} />;
}

function FirmBrainMapView({ profile }: { profile: MapProfile }) {
  const reduceMotion = useReducedMotion();
  const { renderer, Three, fail } = useRenderer();
  const [state, dispatch] = useReducer(mapReducer, INITIAL_MAP_STATE);
  const [answer, setAnswer] = useState<FirmAskResult | null>(null);
  const [replayKey, setReplayKey] = useState(0);

  // Read fresh every time the view opens, so a board with sharing turned off is gone at the next load.
  const query = useQuery({
    queryKey: ["firm-map", profile.id ?? null],
    staleTime: 0,
    retry: (count, error) => !(error instanceof Response) && count < 1,
    queryFn: (): Promise<FirmGraph> => getFirmMap({ data: { profile_id: profile.id ?? null } }),
  });
  const layout = useMemo(() => (query.data ? layoutFirmMap(query.data) : null), [query.data]);

  // Step 4: the answer pulls exactly the engagements it quoted. A new question, not found or a people question pulls nothing.
  useEffect(() => {
    dispatch({
      type: "trace",
      threadIds: answerTrace(answer, layout?.threads.map((thread) => thread.id) ?? []),
    });
  }, [answer, layout]);

  const lit = useMemo(() => (layout ? litThreads(state, layout) : null), [state, layout]);
  const bright = useMemo(() => (layout ? litNodesOf(lit, layout) : null), [lit, layout]);
  const delays = useMemo(
    () => (layout ? replayDelaysOf(layout) : new Map<string, number>()),
    [layout],
  );
  const selected = selectedNode(state);

  const refused = query.error instanceof Response && query.error.status === 403;
  const askBox = <AskTheFirm profile={profile} className="flex flex-col" onResult={setAnswer} />;
  if (refused) return askBox;

  const hasThreads = Boolean(layout && layout.threads.length);
  const drawn = hasThreads && renderer !== "list";
  const rendererProps: FirmMapRendererProps | null = layout
    ? {
        layout,
        lit,
        litNodes: bright,
        selected,
        reduceMotion,
        replayKey,
        replayDelays: delays,
        onHover: (nodeId) => dispatch({ type: "hover", nodeId }),
        onPick: (nodeId) => dispatch({ type: "pick", nodeId }),
        onFail: fail,
      }
    : null;

  return (
    <section
      data-testid="firm-brain-map"
      data-renderer={hasThreads ? renderer : "none"}
      aria-labelledby="firm-brain-map-title"
      className="flex flex-col gap-4 rounded-[var(--radius)] border border-border bg-card p-4 shadow-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="firm-brain-map-title"
            className="text-(length:--type-title) font-medium text-foreground"
          >
            {FIRM_MAP_COPY.title}
          </h2>
        </div>
        {drawn && !reduceMotion ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="firm-map-replay"
            onClick={() => {
              dispatch({ type: "reset" });
              setReplayKey((key) => key + 1);
            }}
          >
            {FIRM_MAP_COPY.replay}
          </Button>
        ) : null}
      </div>

      {/* 20 Nov 2026: the map comes first. Its one line of explanation is a caption under it, and the question sits
          directly beneath, so the map is on the first screen of a phone and the answer has something to point at. */}
      <div data-firm-map-first className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className={FIRM_MAP_STAGE_CLASS}>
          {query.isPending ? (
            <p role="status" className="p-4 text-(length:--type-small) text-muted-foreground">
              {FIRM_MAP_COPY.loading}
            </p>
          ) : query.isError ? (
            <p className="p-4 text-(length:--type-small) text-muted-foreground">
              {FIRM_MAP_COPY.error}
            </p>
          ) : !hasThreads ? (
            <p className="p-4 text-(length:--type-small) text-muted-foreground">
              {FIRM_MAP_COPY.empty}
            </p>
          ) : renderer === "list" ? (
            <div className="h-full overflow-y-auto p-4">
              <FirmMapList
                layout={layout!}
                lit={lit}
                selected={selected}
                onPick={(nodeId) => dispatch({ type: "pick", nodeId })}
              />
            </div>
          ) : (
            <>
              {renderer === "three" && Three ? (
                <Three {...rendererProps!} />
              ) : (
                <FirmMapFlat {...rendererProps!} />
              )}
              <p
                data-testid="firm-map-totals"
                data-map-keep-clear=""
                className="pointer-events-none absolute left-4 top-3 text-(length:--type-small) text-muted-foreground"
              >
                {`${layout!.totals.engagements} ${FIRM_MAP_COPY.engagements} · ${layout!.totals.situations} ${FIRM_MAP_COPY.situations} · ${layout!.totals.methods} ${FIRM_MAP_COPY.methods}`}
              </p>
              <ul
                aria-hidden="true"
                data-map-keep-clear=""
                className="pointer-events-none absolute bottom-3 right-4 hidden flex-wrap justify-end gap-x-4 gap-y-1 text-(length:--type-small) text-muted-foreground sm:flex"
              >
                <li className="flex items-center gap-1.5">
                  <span className="inline-block h-1 w-5 rounded-[var(--radius-control)] bg-(--live)" />
                  {FIRM_MAP_COPY.key.thread}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="inline-block size-3 rounded-[var(--radius-pill)] bg-foreground" />
                  {FIRM_MAP_COPY.key.situation}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-[var(--radius-pill)] bg-[var(--t-talk,var(--text-secondary))]" />
                  {FIRM_MAP_COPY.key.method}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="inline-block size-1.5 rounded-[var(--radius-pill)] bg-foreground" />
                  {FIRM_MAP_COPY.key.end}
                </li>
              </ul>
            </>
          )}
        </div>

        <aside className="min-w-0 rounded-[var(--radius)] bg-muted p-4 lg:h-[min(70vh,620px)] lg:min-h-[360px] lg:overflow-y-auto">
          {layout ? (
            <FirmMapReading
              reading={readingFor(state, layout)}
              pinned={state.pinned}
              profileId={profile.id}
              onFocus={(threadId) => dispatch({ type: "focus", threadId })}
            />
          ) : null}
        </aside>
      </div>

      <p data-firm-map-hint className="max-w-prose text-(length:--type-small) text-muted-foreground">
        {FIRM_MAP_COPY.hint}
      </p>

      {askBox}

      {drawn ? (
        <details className="text-(length:--type-small)">
          <summary className="cursor-pointer text-muted-foreground">
            {FIRM_MAP_COPY.listTitle}
          </summary>
          <div className="mt-3">
            <FirmMapList
              layout={layout!}
              lit={lit}
              selected={selected}
              onPick={(nodeId) => dispatch({ type: "pick", nodeId })}
            />
          </div>
        </details>
      ) : hasThreads ? null : (
        <p className="text-(length:--type-small) text-muted-foreground">{FIRM_MAP_COPY.privacy}</p>
      )}
    </section>
  );
}
