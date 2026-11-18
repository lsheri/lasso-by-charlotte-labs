import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The plain browser select, styled as a Field to match Input (18 Nov 2026, design component guard). Use it for short
 * fixed choices in forms and dialogs where the keyboard and the phone's own picker matter more than custom options;
 * use Select for rich option rows. A raw <select> outside src/components/ui is counted by design health.
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(({ className, ...props }, ref) => (
  <select
    className={cn(
      "flex h-9 w-full rounded-[var(--radius-control)] border border-input bg-transparent px-2 py-1 text-base transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm aria-[invalid=true]:border-destructive",
      className,
    )}
    ref={ref}
    {...props}
  />
));
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
