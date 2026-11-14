/* The lapel tile: the Monoline C on navy with a lime hub, for the future app icon and avatar. Story only; ships at P5.
   Colours are fixed brand values, not skin tokens: an app icon looks the same on every surface. */
import { tileGeometry } from "./charlotte-mark";

export function CharlotteTile({ size = 64, radius }: { size?: number; radius?: number }) {
  const t = tileGeometry(size, radius);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      data-charlotte-tile={size}
    >
      <rect width="64" height="64" rx={t.rx} fill="#0B2A4A" />
      <g fill="none" stroke="#FAFAF7" strokeLinecap="round">
        <path strokeWidth={t.spokeWidth} d={t.spokes} />
        <path strokeWidth={t.arcWidth} d={t.arc} />
      </g>
      <circle cx="32" cy="32" r={t.hub} fill="#04F85B" stroke="#0B2A4A" strokeWidth="1.6" />
    </svg>
  );
}
