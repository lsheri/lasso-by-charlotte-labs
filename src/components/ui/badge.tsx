import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-grey-2 text-foreground hover:bg-muted",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // 03 · Library · Atoms, StatusChip. Additive: no existing variant moves.
        "needs-mapping":
          "rounded-[var(--radius-pill)] border-[var(--nb-amber-edge)] bg-[var(--nb-amber-wash)] px-2 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--nb-claim-text)]",
        private:
          "rounded-[var(--radius-pill)] border-[var(--nb-rule)] bg-[var(--nb-paper-20)] px-2 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--nb-mid)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
