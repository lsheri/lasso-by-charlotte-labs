import { cn } from "@/lib/utils";

/** The first letters of up to two words of a name, for a face with no picture. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * 20 Nov 2026 (design review): a person is a face and a name, never a sentence. Until a picture exists the face is
 * their initials on the sunk wash. Decorative: the name always sits beside it as text.
 */
export function PersonFace({ name, size = "md", className }: { name: string; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-person-face
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground",
        size === "sm" ? "size-7 text-(length:--type-label)" : "size-9 text-(length:--type-small)",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
