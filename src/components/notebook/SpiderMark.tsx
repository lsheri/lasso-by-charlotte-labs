/**
 * The Lasso spider mascot. Founder-decided brand exception: a raster mark, not
 * a graphite glyph from icons.tsx. It is used only beside the "Ask Lasso"
 * label; the ask-lasso glyph in tabs and the composer stays as it is.
 *
 * Pass 103: one still frame that wobbles side to side once every eight
 * seconds. The old two-frame swap read as a flash, so there is now a single
 * image and a single CSS animation. Reduced motion leaves it completely still.
 */
import staticUrl from "@/assets/lasso-spider-static.png";

export function SpiderMark({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex shrink-0 items-center ${className}`}>
      <img
        alt=""
        aria-hidden
        draggable={false}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        src={staticUrl}
        className="nb-spider-wobble align-middle"
      />
    </span>
  );
}
