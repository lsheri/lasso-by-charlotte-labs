export function DimmedDisabled({
  dimmed,
  children,
  className = "",
}: {
  dimmed: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      {...(dimmed
        ? {
            "aria-disabled": true,
            "data-testid": "dimmed-disabled",
            inert: true,
          }
        : {})}
      className={`${dimmed ? "pointer-events-none opacity-50" : ""} ${className}`}
    >
      {children}
    </div>
  );
}