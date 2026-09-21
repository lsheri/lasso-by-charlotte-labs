export function DimmedDisabled({
  dimmed,
  disabled = false,
  children,
  className = "",
}: {
  dimmed: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      {...(disabled
        ? {
            "aria-disabled": true,
            inert: true,
          }
        : {})}
      {...(dimmed ? { "data-testid": "dimmed-disabled" } : {})}
      className={`${dimmed ? "opacity-50" : ""} ${disabled ? "pointer-events-none" : ""} min-w-0 w-full ${className}`}
    >
      {children}
    </div>
  );
}