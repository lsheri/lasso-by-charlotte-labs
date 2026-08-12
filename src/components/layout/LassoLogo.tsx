import logoAsset from "@/assets/lasso-mascots.png.asset.json";

const SIZES = { sm: "h-6", md: "h-9", lg: "h-14", xl: "h-40 md:h-56" } as const;

/** The Charlotte Labs mascots, shared logo mark for Lasso. */
export function LassoLogo({
  size = "sm",
  className = "",
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <img
      src={logoAsset.url}
      alt="Lasso by Charlotte Labs"
      className={`${SIZES[size]} w-auto shrink-0 select-none ${className}`}
      loading="lazy"
      decoding="async"
    />
  );
}
