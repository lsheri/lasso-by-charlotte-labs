import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Peek, don't navigate: a right-hand dock at reading width on desktop, a
 * full-screen sheet at 390px. Esc and click-outside close it; the page behind
 * never shifts because the panel is fixed and overlaid.
 */
export function SlideOver({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex w-full flex-col gap-0 border-l border-border bg-background p-0 shadow-xl",
          "sm:w-[540px] sm:max-w-[560px]",
          "data-[state=open]:duration-200 data-[state=closed]:duration-200",
          className,
        )}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <SheetDescription className="sr-only">{description ?? title}</SheetDescription>
        {children}
      </SheetContent>
    </Sheet>
  );
}
