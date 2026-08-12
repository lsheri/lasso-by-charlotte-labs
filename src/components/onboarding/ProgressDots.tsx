export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="mt-8 flex items-center gap-2" aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className={
            i === current
              ? "h-1.5 w-6 rounded-full bg-accent-deep"
              : "h-1.5 w-1.5 rounded-full bg-border"
          }
        />
      ))}
    </div>
  );
}
