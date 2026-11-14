/* Renders one Charlotte (Exhibit) glyph. Storybook only: the app draws Charlotte glyphs through GraphiteIcon (PR4). */
import { EXHIBIT_DASH, EXHIBIT_STROKE, type ExhibitPath } from "./charlotte";

export function ExhibitIcon({
  d,
  size = 16,
  title,
}: {
  d: readonly ExhibitPath[];
  size?: number;
  title?: string;
}) {
  return (
    <svg
      className="ex-ico"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={EXHIBIT_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {d.map((path, i) =>
        typeof path === "string" ? (
          <path key={i} d={path} pathLength={1} />
        ) : (
          // No pathLength here: it rescales the dash array, and a 2.1 dash on a length of 1 draws solid.
          <path key={i} d={path.d} strokeDasharray={EXHIBIT_DASH} />
        ),
      )}
    </svg>
  );
}
