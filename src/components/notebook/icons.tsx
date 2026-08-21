import * as React from "react";
import { cn } from "@/lib/utils";
export type GraphiteIconName = "connectors" | "work" | "engagement" | "overview" | "reflect" | "ai-record" | "one-on-one" | "decisions" | "firm" | "members" | "settings" | "ask-lasso" | "messages" | "history" | "analyses" | "send" | "attach" | "search" | "plus" | "close" | "chevron-right" | "drag-handle" | "check" | "external-link";
type IconDef = { d: string[]; sig: string; sigIndex?: number; origin?: string };
const ICONS: Record<GraphiteIconName, IconDef> = {
  connectors: { d: ["M7.2 3.8v3.3M12.8 3.7v3.5", "M4.8 7.3h10.5v2.5a5.2 5.2 0 01-5.3 5.2 5.2 5.2 0 01-5.2-5.3V7.3zM10 15.1c.1 1.2-.5 1.7-.4 3.1"], sig: "nb-sig-seat", sigIndex: 1 },
  work: { d: ["M4.4 7.2l5.6-2.9 5.6 2.9-5.6 2.8-5.6-2.8zM13.4 5.8c1.3-.6 1.7-1.4 1.2-2.3", "M4.5 10.4l5.5 2.7 5.6-2.7M4.5 13.4l5.5 2.8 5.6-2.8"], sig: "nb-sig-lift", sigIndex: 0, origin: "6px 8px" },
  engagement: { d: ["M3.3 15.5V5.1h4.3l1.5 2h5.3v2.2", "M3.4 15.5l2-6.3h11.4l-2.1 6.3H3.4z"], sig: "nb-sig-flap", sigIndex: 1, origin: "10px 15px" },
  overview: { d: ["M2.9 13.7h14.2M5.6 13.6h.1", "M6.6 13.6a3.5 3.5 0 016.9-.1"], sig: "nb-sig-rise", sigIndex: 1 },
  reflect: { d: ["M13.4 14.7c3.2-1.5 4.4-5.4 2.1-8-2.4-2.7-7.6-2.8-9.9.1-2 2.5-1 6 1.9 7.2", "M5.9 15.7l1.3 1.9 1.6-1.5"], sig: "nb-sig-tilt", origin: "10px 10px" },
  "ai-record": { d: ["M5 3.6h10v10.6l-3.5 3.2v-3.2H5V3.6zM7.6 7.1h4.8M7.6 10.1h3.1"], sig: "nb-sig-pop", origin: "10px 10px" },
  "one-on-one": { d: ["M11.4 2.2h4.6a1.6 1.6 0 011.6 1.6v2.1a1.6 1.6 0 01-1.6 1.6h-.4v1.7l-2.1-1.7h-2.1a1.6 1.6 0 01-1.6-1.6V3.8a1.6 1.6 0 011.6-1.6z", "M4.1 9.8h7.6a1.9 1.9 0 011.9 1.9v2.5a1.9 1.9 0 01-1.9 1.9H7.6l-2.9 2.2v-2.2h-.6a1.9 1.9 0 01-1.9-1.9v-2.5a1.9 1.9 0 011.9-1.9z"], sig: "nb-sig-pop", sigIndex: 1, origin: "8px 13px" },
  decisions: { d: ["M10 17.8v-4.4l-2.6-2.6M6.5 9.6l-.7-.7", "M10 13.4l4.4-4.4V3.8M12.5 5.5L14.4 3.6l1.9 1.9"], sig: "nb-sig-scuff", sigIndex: 1 },
  firm: { d: ["M4.2 16.8V5.2h11.6v11.6M2.9 16.8h14.2", "M7.1 8.5h1.9M11 8.5h1.9", "M8.4 16.7v-4.3h3.2v4.3"], sig: "nb-sig-nudge" },
  members: { d: ["M3 16.3c.3-2.7 1.8-4 3.9-4s3.6 1.3 3.9 4M6.9 4.3a2.5 2.5 0 11-.1 5.1 2.5 2.5 0 01.1-5.1", "M13.6 5.5a2.1 2.1 0 11.2 4.3M14.1 12.5c1.8.1 2.9 1.4 3.2 3.8"], sig: "nb-sig-lean-in", sigIndex: 1, origin: "13px 16px" },
  settings: { d: ["M3.3 7.1h11.4M16.7 7.1h-.5M3.3 13h4.9M10.9 13h5.8", "M12.4 7.1a1.9 1.9 0 11-3.9 0 1.9 1.9 0 013.9 0", "M10.8 13a1.9 1.9 0 11-3.8 0 1.9 1.9 0 013.8 0"], sig: "nb-sig-slide", sigIndex: 2, origin: "10px 13px" },
  "ask-lasso": { d: ["M13.6 5.7C9.2 3.5 4 6.1 4.1 10.3c.1 3.6 4.4 6 8.3 4.7 3.5-1.1 4.6-5 2.3-6.6-1.5-1.1-4.1-.4-4.4 1.3", "M13.6 5.7c1.2-.6 1.5-1.6 1-2.7"], sig: "nb-sig-flick", sigIndex: 1, origin: "14px 5px" },
  messages: { d: ["M3.6 5.1h12.9v8.4H9L5.4 16.6v-3.1H3.6V5.1z"], sig: "nb-sig-pop", origin: "10px 11px" },
  history: { d: ["M5.1 5.4A6.9 6.9 0 113.1 10.3", "M2.6 4.9l2.5.5-.4 2.6", "M10 6.2v4.1h3.3"], sig: "nb-sig-sweep", sigIndex: 2, origin: "10px 10.3px" },
  analyses: { d: ["M11.7 5h5.5M11.7 8.2h3.6M13.4 11.6h3.8", "M9.4 7.4a3.2 3.2 0 11-6.4 0 3.2 3.2 0 016.4 0M8.6 9.8l2.3 2.3"], sig: "nb-sig-lens", sigIndex: 1 },
  send: { d: ["M17.1 3.3L3.4 8.8l5.7 2.3 2.2 5.7L17.1 3.3M9.1 11.1l3.4-3.4"], sig: "nb-sig-fly", origin: "10px 10px" },
  attach: { d: ["M12.9 6.2L7.6 11.5a2.2 2.2 0 003.2 3.1l5.4-5.6a3.7 3.7 0 00-5.2-5.2L5.1 9.9"], sig: "nb-sig-pinch", origin: "10px 10px" },
  search: { d: ["M12.7 8.3a4.3 4.3 0 11-8.6.1 4.3 4.3 0 018.6-.1M11.7 11.5l4.8 4.9"], sig: "nb-sig-scan" },
  plus: { d: ["M10 4v12.1M4 10.1h12.1"], sig: "nb-sig-turn", origin: "10px 10px" },
  close: { d: ["M5 5.1l10 9.8", "M15 5l-10 9.9"], sig: "nb-sig-flick-2" },
  "chevron-right": { d: ["M7.5 4.2l6.1 5.9-6 5.7"], sig: "nb-sig-forward" },
  "drag-handle": { d: ["M7.5 5.3h.1M12.4 5.2h.1", "M7.5 10h.1M12.4 10h.1", "M7.6 14.7h.1M12.4 14.8h.1"], sig: "nb-sig-wave" },
  check: { d: ["M3.5 10.3c1.7.7 3.2 2 4.3 3.7C9.7 9.7 12.7 6.1 16.7 3.8"], sig: "nb-sig-overshoot", origin: "4px 12px" },
  "external-link": { d: ["M10.6 3.4H3.4v13.2h13.2V9.4", "M8.6 11.4L17.2 2.8M13.4 2.6h4.2v4.2"], sig: "nb-sig-leap", sigIndex: 1 },
};
export const ICON_NAMES = Object.keys(ICONS) as GraphiteIconName[];
export function getIconSignature(name: GraphiteIconName) { return ICONS[name].sig; }
export function GraphiteIcon({ name, size = 16, className, title, animate = true, playOnMount = false }: { name: GraphiteIconName; size?: number; className?: string; title?: string; animate?: boolean; playOnMount?: boolean }) {
  const def = ICONS[name];
  return (
    <svg className={cn("nb-ico", className)} data-icon={name} data-anim={animate ? "1" : undefined} data-play={playOnMount ? "1" : undefined} style={{ ["--nb-sig" as string]: def.sig }} width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {title ? <title>{title}</title> : null}
      {def.d.map((d, i) => { const signed = def.sigIndex === undefined || def.sigIndex === i; return (<path key={i} d={d} pathLength={1} className={signed ? "nb-sig" : undefined} style={signed && def.origin ? { transformOrigin: def.origin } : undefined} />); })}
    </svg>
  );
}
export default GraphiteIcon;
