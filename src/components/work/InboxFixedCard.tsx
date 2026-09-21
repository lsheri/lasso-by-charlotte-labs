import { Pin } from "lucide-react";

export function InboxFixedCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-testid="inbox-fixed-card"
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      className="relative min-w-0 w-full cursor-default select-text"
    >
      <span
        data-non-drag-affordance
        aria-label="Fixed in inbox"
        title="Fixed in inbox"
        className="pointer-events-none absolute -left-2 top-2 z-10 grid h-4 w-4 place-items-center text-muted-foreground"
      >
        <Pin className="h-2.5 w-2.5" aria-hidden />
      </span>
      {children}
    </div>
  );
}