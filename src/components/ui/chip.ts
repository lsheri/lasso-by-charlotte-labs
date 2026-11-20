import { cva, type VariantProps } from "class-variance-authority";

// G7 (17 Nov 2026): the small pill button (Add, Remove, Share, scope and window toggles).
// It was written out by hand in 15 places; this is the one place to change it.
// quiet: a hairline chip in muted ink. accent: the chosen or primary chip, on the accent wash.
// 20 Nov 2026 (design review, D-74): plain Archivo in sentence case. Mono capitals are for numbers and times only.
export const chipVariants = cva(
  "rounded-full px-3 py-1 font-sans text-(length:--type-small) font-medium disabled:opacity-50",
  {
    variants: {
      tone: {
        quiet: "border border-border text-muted-foreground transition-colors hover:text-foreground",
        accent: "border border-accent bg-accent-soft text-accent-deep transition-opacity",
      },
    },
    defaultVariants: { tone: "quiet" },
  },
);

export type ChipVariantProps = VariantProps<typeof chipVariants>;
