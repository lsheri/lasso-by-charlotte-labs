import { describe, expect, it } from "vitest";

import { Route } from "./__root";

describe("PF2 font preloads", () => {
  const headDefinition = Route.options.head;
  if (!headDefinition) {
    throw new Error("Root route head definition is missing");
  }
  const headResult = headDefinition({} as never);
  if (headResult instanceof Promise) {
    throw new Error("Root route head definition unexpectedly returned a promise");
  }
  const head = headResult;
  const links = (head?.links ?? []).filter(
    (link): link is NonNullable<typeof link> => link !== undefined,
  );
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
      const href = preload.href;
      if (typeof href !== "string") {
        throw new Error("Font preload href is not a string");
      }
      expect(href.length).toBeGreaterThan(0);
      expect(href).toMatch(/\.woff2(?:\?|$)/);
      expect(href).not.toMatch(/^(caveat|jetbrains-mono|archivo)$/);
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