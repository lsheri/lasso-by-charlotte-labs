/**
 * The Lasso spider mascot (hotfix 88.1). Founder-decided brand exception: an
 * animated raster that loops idle, not a graphite glyph from icons.tsx. It is
 * used only beside the "Ask Lasso" label; the ask-lasso glyph in tabs and the
 * composer stays as it is.
 *
 * Reduced motion is handled without JavaScript: both frames render and CSS
 * swaps them, so there is no hydration flicker and no media-query listener.
 */
import spinUrl from "@/assets/lasso-spider-spin.gif";
import staticUrl from "@/assets/lasso-spider-static.png";

export function SpiderMark({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const common = {
    alt: "",
    "aria-hidden": true,
    draggable: false,
    width: size,
    height: size,
    style: { width: size, height: size },
    className: "inline-block align-middle",
  } as const;

  return (
    <span className={`inline-flex shrink-0 items-center ${className}`}>
      <img {...common} src={spinUrl} className={`${common.className} nb-spider-anim`} />
      <img {...common} src={staticUrl} className={`${common.className} nb-spider-static`} />
    </span>
  );
}
