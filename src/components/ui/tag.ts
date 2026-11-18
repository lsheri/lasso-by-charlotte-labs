import { cva, type VariantProps } from "class-variance-authority";

// G7 (17 Nov 2026): the small mono label pill that marks a row (status, kind, role, count). Not a control: the
// clickable pill is chipVariants in chip.ts. It was written out by hand in 20 places; this is the one place to change it.
// neutral: hairline on the sunk wash. accent: the accent wash in accent ink. muted: a quiet grey fill.
// outline: hairline only.
export const tagVariants = cva(
  "rounded-full px-2 py-0.5 font-mono text-(length:--type-label) uppercase tracking-[0.08em]",
  {
    variants: {
      tone: {
        neutral: "border border-border bg-secondary text-muted-foreground",
        accent: "bg-accent-soft text-accent-deep",
        muted: "bg-muted text-muted-foreground",
        outline: "border border-border text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type TagVariantProps = VariantProps<typeof tagVariants>;
