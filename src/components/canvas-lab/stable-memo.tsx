import { memo, useRef, type ComponentType } from "react";

/**
 * BB-3: a per-card memo for the board. A keystroke in one card must not
 * re-render the others, but the page builds fresh callbacks and small arrays on
 * every render. This wrapper compares data props by value (two levels deep),
 * ignores callback identity, and hands the card stable callback proxies that
 * always call the newest function, so a skipped render never runs a stale one.
 */
function sameValue(a: unknown, b: unknown, depth: number): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a === "function" && typeof b === "function") return true;
  if (depth <= 0 || !a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const protoA = Object.getPrototypeOf(a);
  if (protoA !== Object.prototype && protoA !== Array.prototype) return false;
  if (protoA !== Object.getPrototypeOf(b)) return false;
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], depth - 1));
}

export function sameCardProps(prev: Record<string, unknown>, next: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const key of keys) {
    const a = prev[key];
    const b = next[key];
    if ((typeof a === "function") !== (typeof b === "function")) return false;
    if (typeof a === "function") continue;
    if (!sameValue(a, b, 2)) return false;
  }
  return true;
}

export function stableMemo<P extends object>(Inner: ComponentType<P>): ComponentType<P> {
  // The card itself only re-renders when its data changes. The thin outer layer
  // runs on every parent render to keep the callback proxies pointing at the
  // newest functions, so a skipped card never calls a stale one.
  const MemoInner = memo(Inner, (a, b) => sameCardProps(a as Record<string, unknown>, b as Record<string, unknown>));
  function Stable(props: P) {
    const latest = useRef(props);
    latest.current = props;
    const proxies = useRef(new Map<string, (...args: unknown[]) => unknown>());
    const passed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      if (typeof value !== "function") { passed[key] = value; continue; }
      let proxy = proxies.current.get(key);
      if (!proxy) {
        proxy = (...args: unknown[]) => (latest.current as Record<string, (...a: unknown[]) => unknown>)[key]?.(...args);
        proxies.current.set(key, proxy);
      }
      passed[key] = proxy;
    }
    return <MemoInner {...(passed as P)} />;
  }
  Stable.displayName = `Stable(${Inner.displayName ?? Inner.name ?? "Card"})`;
  return Stable;
}
