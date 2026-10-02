import { describe, expect, it } from "vitest";

import { Route } from "./__root";

describe("PF2 font preloads", () => {
  const head = Route.options.head?.({} as never);
  const links = head?.links ?? [];
  const fontPreloads = links.filter(
    (link) => link.rel === "preload" && "as" in link && link.as === "font",
  );

  it("preloads exactly the three first-paint fonts", () => {
    expect(fontPreloads).toHaveLength(3);
  });

  it("uses matching CORS and woff2 attributes on every font preload", () => {
    expect(fontPreloads).toHaveLength(3);
    for (const preload of fontPreloads) {
      expect(preload).toMatchObject({
        crossOrigin: "anonymous",
        type: "font/woff2",
      });
    }
  });

  it("resolves every preload to a non-empty font URL", () => {
    expect(fontPreloads).toHaveLength(3);
    for (const preload of fontPreloads) {
      expect(typeof preload.href).toBe("string");
      expect(preload.href.length).toBeGreaterThan(0);
      expect(preload.href).toMatch(/\.woff2(?:\?|$)/);
      expect(preload.href).not.toMatch(/^(caveat|jetbrains-mono|archivo)$/);
    }
  });

  it("keeps the stylesheet after all three font preloads", () => {
    const stylesheetIndex = links.findIndex((link) => link.rel === "stylesheet");
    const preloadIndexes = fontPreloads.map((preload) => links.indexOf(preload));

    expect(stylesheetIndex).toBeGreaterThanOrEqual(0);
    expect(preloadIndexes).toHaveLength(3);
    expect(preloadIndexes.every((index) => index >= 0 && index < stylesheetIndex)).toBe(true);
  });
});