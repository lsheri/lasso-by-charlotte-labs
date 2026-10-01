import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { LASSO_HOME, readEntryDoor, resolveEntryDoorHref } from "@/lib/entry-door";

/**
 * Signed-out wordmark link. Lasso's "/" stays an internal router link; a
 * known entry door becomes a plain same-tab link back to that property.
 */
export function EntryDoorLink({
  className,
  children,
  "aria-current": ariaCurrent,
}: {
  className?: string;
  children: ReactNode;
  "aria-current"?: "page" | undefined;
}) {
  const [href, setHref] = useState<string>(LASSO_HOME);
  useEffect(() => {
    setHref(resolveEntryDoorHref(readEntryDoor()));
  }, []);

  if (href === LASSO_HOME) {
    return (
      <Link to="/" className={className} aria-current={ariaCurrent}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} aria-current={ariaCurrent}>
      {children}
    </a>
  );
}
