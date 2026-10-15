import { Skeleton } from "@/components/ui/skeleton";

import { BrandLockup } from "./BrandLockup";

const blockClass = "motion-reduce:animate-none";

export function AppShellSkeleton() {
  return (
    <div aria-busy="true" className="flex min-h-screen w-full bg-background">
      <span className="sr-only">Opening Lasso</span>
      <aside aria-hidden="true" className="lasso-sidebar-shell hidden shrink-0 md:block">
        <div className="sticky top-0 flex h-screen flex-col gap-[22px] bg-sidebar px-4 pb-[18px] pt-[22px]">
          <BrandLockup className="gap-2.5 [&_svg]:h-[17px] [&_svg]:w-5 [&_span]:text-lg" />
          <Skeleton className={`${blockClass} h-12 w-full`} />
          <div className="flex flex-col gap-5">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className={`${blockClass} h-3 w-32`} />
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-5">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className={`${blockClass} h-3 w-28`} />
            ))}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header aria-hidden="true" className="sticky top-0 z-40 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/95 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] md:hidden">
          <BrandLockup className="gap-2 [&_svg]:h-6 [&_svg]:w-6 [&_span]:text-sm" />
          <Skeleton className={`${blockClass} h-11 w-28`} />
        </header>
        <main aria-hidden="true" className="flex-1 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-6 md:px-8 md:py-12 md:pb-14 lg:px-10 xl:px-14">
          <div className="mx-auto w-full max-w-[1440px]">
            <Skeleton className={`${blockClass} mb-8 h-3 w-36`} />
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className={`${blockClass} h-48 w-full border border-border`} />
              <Skeleton className={`${blockClass} h-48 w-full border border-border`} />
              <Skeleton className={`${blockClass} h-48 w-full border border-border md:col-span-2`} />
            </div>
          </div>
        </main>
      </div>
      <div aria-hidden="true" className="nb-tabbar grid-cols-3 md:hidden">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex flex-col items-center justify-center gap-2">
            <Skeleton className={`${blockClass} h-[18px] w-[18px]`} />
            <Skeleton className={`${blockClass} h-2 w-12`} />
          </div>
        ))}
      </div>
    </div>
  );
}