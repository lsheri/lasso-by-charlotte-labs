// @vitest-environment jsdom
// 19 Nov 2026 (Liam): under Slate / Spool script the product is called Lasso everywhere; under the current look it
// stays Charlotte. One source decides the name, and the page, the server, the icons and the guard all follow it.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { brandHeadTags } from "@/components/skin/BrandHeadContent";
import { LassoThinkingMark } from "@/components/reflect/LassoThinkingMark";
import { BrandVariantContext, SkinContext } from "@/components/skin/use-skin";
import {
  brandCopy,
  BRANDS,
  brandFile,
  brandFor,
  brandThemeColor,
  brandTitle,
  launchBrand,
  makerLine,
  rebrandTitle,
} from "@/design/brand/brand";
import { serverBrand, variantFromCookieHeader } from "@/lib/brand-server";
import { DEFAULT_BRAND_VARIANT } from "@/lib/brand-variant-shared";
import { earlierNameLine } from "@/lib/mcp-earlier-name";

const SLATE = brandFor("charlotte", "slate-spool");
const QA = "qa.company.admin@qaprobe.test";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("the server's name follows the default look", () => {
  it("speaks as the launch skin in the default variant, so one line renames emails, the connector and the head", () => {
    expect(launchBrand()).toEqual(brandFor("charlotte", DEFAULT_BRAND_VARIANT));
    expect(launchBrand(true, "current").name).toBe("Charlotte");
    expect(launchBrand(true, "slate-spool")).toEqual(SLATE);
    // Before the flip the original Lasso is untouched by any variant.
    expect(launchBrand(false, "slate-spool")).toBe(BRANDS.lasso);
  });

  it("every server module that names the product reads launchBrand or serverBrand, never a literal", () => {
    for (const path of [
      "src/lib/mcp-handler.server.ts",
      "src/lib/email-templates/send-email.ts",
      "src/lib/mcp-setup-steps.ts",
      "src/lib/mcp-oauth.server.ts",
    ]) {
      const text = readFileSync(path, "utf8");
      expect(text, path).toContain("launchBrand()");
      expect(text.replace(/\/\/.*$/gm, ""), path).not.toMatch(/["'`]Charlotte["'`]/);
    }
  });

  it("under Lasso the connector needs no earlier-name line and signs as Lasso by Charlotte Labs", () => {
    expect(earlierNameLine(SLATE.name)).toBe("");
    expect(makerLine(SLATE)).toBe("Lasso by Charlotte Labs");
    expect(brandFile("https://x.test/favicon.svg", SLATE.look.mark)).toBe(
      "https://x.test/slate-favicon.svg",
    );
  });

  it("the AI speaks as the look the page shows, for an allowed account only", () => {
    expect(serverBrand("charlotte", QA, "slate-spool").name).toBe("Lasso");
    expect(serverBrand("charlotte", QA, "current").name).toBe("Charlotte");
    expect(serverBrand("charlotte", QA).name).toBe(launchBrand().name);
    // A hand-set cookie never renames the product for anyone else.
    expect(serverBrand("charlotte", "someone@example.com", "slate-spool").name).toBe(
      launchBrand().name,
    );
    expect(variantFromCookieHeader("a=1; brand_variant=slate-spool; b=2")).toBe("slate-spool");
    expect(variantFromCookieHeader("brand_variant=nonsense")).toBeNull();
    expect(variantFromCookieHeader(null)).toBeNull();
  });
});

describe("the head under each look", () => {
  const tags = [
    { tag: "title" as const, children: "Sign in | Lasso" },
    {
      tag: "meta" as const,
      attrs: {
        property: "og:title",
        // The root writes its default card title in the launch brand's name, whichever look that is.
        content: brandCopy(launchBrand(), "Lasso | The knowledge trace for AI-assisted work"),
      },
    },
    { tag: "meta" as const, attrs: { name: "theme-color", content: "#fafaf8" } },
    { tag: "meta" as const, attrs: { name: "application-name", content: launchBrand().name } },
    {
      tag: "meta" as const,
      attrs: { property: "og:image", content: "https://lasso.charlotte-labs.com/og-image.png" },
    },
    { tag: "link" as const, attrs: { rel: "icon", href: "/favicon.svg" } },
    { tag: "link" as const, attrs: { rel: "icon", href: "/favicon-32.png" } },
    { tag: "link" as const, attrs: { rel: "apple-touch-icon", href: "/apple-touch-icon.png" } },
    { tag: "link" as const, attrs: { rel: "manifest", href: "/manifest.webmanifest" } },
  ];
  const flat = (out: ReturnType<typeof brandHeadTags>) => JSON.stringify(out);

  it("Slate names Lasso, uses the spool files and the Slate ground, with no Charlotte anywhere but the domain", () => {
    const out = brandHeadTags(tags, "charlotte", "slate-spool");
    expect(out[0]).toEqual({ tag: "title", children: "Sign in | Lasso" });
    expect(out[1]?.attrs?.["content"]).toBe("Lasso | The knowledge trace for AI-assisted work");
    expect(out[2]?.attrs?.["content"]).toBe("#eceef0");
    expect(out[3]?.attrs?.["content"]).toBe("Lasso");
    expect(out[4]?.attrs?.["content"]).toBe("https://lasso.charlotte-labs.com/slate-og-image.png");
    expect(out.slice(5).map((tag) => tag.attrs?.["href"])).toEqual([
      "/slate-favicon.svg",
      "/slate-favicon-32.png",
      "/slate-apple-touch-icon.png",
      "/slate-manifest.webmanifest",
    ]);
    expect(flat(out).replace(/lasso\.charlotte-labs\.com/g, "")).not.toMatch(/charlotte/i);
  });

  it("the current look names Charlotte with its own files and never a spool file", () => {
    const out = brandHeadTags(tags, "charlotte", "current");
    expect(out[0]).toEqual({ tag: "title", children: "Sign in | Charlotte" });
    expect(out[2]).toBe(tags[2]);
    expect(flat(out)).not.toContain("slate-");
    expect(flat(out).replace(/lasso\.charlotte-labs\.com/g, "")).not.toMatch(/lasso/i);
    expect(brandHeadTags(tags, "charlotte")).toEqual(out);
  });

  it("every spool file the head can name exists in public/", () => {
    for (const file of [
      "/favicon.svg",
      "/favicon-32.png",
      "/apple-touch-icon.png",
      "/manifest.webmanifest",
      "/og-image.png",
    ]) {
      expect(statSync(`public${brandFile(file, "spool")}`).size).toBeGreaterThan(0);
    }
    const manifest = JSON.parse(readFileSync("public/slate-manifest.webmanifest", "utf8")) as {
      name: string;
      icons: { src: string }[];
    };
    expect(manifest.name).toBe("Lasso");
    for (const icon of manifest.icons)
      expect(statSync(`public${icon.src}`).size).toBeGreaterThan(0);
    // At rest in a tab: no lime in the favicon.
    expect(readFileSync("public/slate-favicon.svg", "utf8").toLowerCase()).not.toContain("04f85b");
  });

  it("a colour a route chose for itself is left alone", () => {
    expect(brandThemeColor("#000000", "spool")).toBe("#000000");
    expect(brandThemeColor("#fafaf8", "charlotte")).toBe("#fafaf8");
  });

  it("a title already in the tab moves between brands, in both directions", () => {
    expect(rebrandTitle(BRANDS.charlotte, SLATE, "Sign in | Charlotte")).toBe("Sign in | Lasso");
    expect(rebrandTitle(BRANDS.charlotte, SLATE, "Charlotte | The knowledge trace")).toBe(
      "Lasso | The knowledge trace",
    );
    expect(rebrandTitle(BRANDS.charlotte, SLATE, "Why Charlotte, the coach in your corner")).toBe(
      "Why Lasso, the coach in your corner",
    );
    expect(rebrandTitle(SLATE, BRANDS.charlotte, "Sign in | Lasso")).toBe("Sign in | Charlotte");
    expect(rebrandTitle(BRANDS.charlotte, BRANDS.charlotte, "Sign in | Lasso")).toBe(
      "Sign in | Charlotte",
    );
    expect(rebrandTitle(BRANDS.charlotte, BRANDS.charlotte, "Sign in | Charlotte")).toBe(
      "Sign in | Charlotte",
    );
    // A person's own board title is never rewritten mid-sentence.
    expect(rebrandTitle(BRANDS.charlotte, SLATE, "Notes on Charlotte the spider | Charlotte")).toBe(
      "Notes on Charlotte the spider | Lasso",
    );
    expect(brandTitle(SLATE, "Sign in | Lasso")).toBe("Sign in | Lasso");
  });
});

describe("the page and the shell", () => {
  const root = readFileSync("src/routes/__root.tsx", "utf8");

  it("makes the whole page the Slate token scope, on the server and after a change, and only under the look", () => {
    expect(root).toContain('<body data-lasso={theme ? "on" : undefined}>');
    expect(root).toContain('<BrandHeadContent skin={skin} variant={theme ?? "current"} />');
    const provider = readFileSync("src/components/skin/BrandVariantProvider.tsx", "utf8");
    expect(provider).toContain('document.body.setAttribute("data-lasso", "on")');
    expect(provider).toContain('document.body.removeAttribute("data-lasso")');
  });

  it("keeps the variant outside the skin provider, so the tab title can follow it", () => {
    expect(root.indexOf("<BrandVariantProvider initial={brandVariant}>")).toBeLessThan(
      root.indexOf("<SkinProvider initial={skin}>"),
    );
    expect(readFileSync("src/components/skin/SkinProvider.tsx", "utf8")).toContain(
      "brandFor(skin, variant)",
    );
  });

  it("Home's welcome mark is a flourish: the spool thread stays in ink, and lime still means work elsewhere", () => {
    const draw = (flourish: boolean) =>
      render(
        <SkinContext.Provider value="charlotte">
          <BrandVariantContext.Provider value="slate-spool">
            <LassoThinkingMark kind="signature" size={40} thinking flourish={flourish} />
          </BrandVariantContext.Provider>
        </SkinContext.Provider>,
      ).container.querySelector("svg")!;
    expect(draw(true).getAttribute("data-spool-state")).toBe("rest");
    expect(draw(false).getAttribute("data-spool-state")).toBe("live");
    expect(readFileSync("src/components/home/HomeBoard.tsx", "utf8")).toContain(
      "thinking flourish />",
    );
  });
});

describe("no product name is typed into the app", () => {
  // Copy is written as Lasso and renamed by brandCopy, so a typed "Charlotte" would survive under Slate.
  const ALLOWED: Record<string, string> = {
    "src/design/brand/brand.ts": "the one source of both names",
    "src/design/brand/brand-marks.ts":
      "the registry's notes on which drawing is whose, read by developers",
    "src/components/work/SkinnedKindIcon.tsx":
      "an error thrown at build time for a missing glyph, never shown",
    "src/lib/demo-firm/validate.ts":
      "a seed check's own message to developers, never shown in the app",
  };

  it("names Charlotte only in the listed files (Charlotte Labs, the company, is not the product)", () => {
    const typed = sourceFiles("src")
      .filter(
        (path) =>
          /\.tsx?$/.test(path) && !path.includes("__tests__") && !/\.(test|stories)\./.test(path),
      )
      .filter((path) => {
        const code = readFileSync(path, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "")
          .replace(/\s\/\/ .*$/gm, "")
          .replace(/Charlotte Labs/g, "");
        return /\bCharlotte\b/.test(code);
      });
    expect(typed.sort()).toEqual(Object.keys(ALLOWED).sort());
  });
});

describe("the brand guard", () => {
  const guard = readFileSync("tests/e2e/brand-guard.spec.ts", "utf8");

  it("has a Lasso mode keyed on the look and stays strict both ways", () => {
    expect(guard).toContain('process.env["LASSO_BRAND_GUARD_LOOK"] === "slate-spool"');
    // Slate on: no Charlotte, no Charlotte C, no Lasso loop.
    expect(guard).toContain("forbidden: /charlotte/i");
    expect(guard).toContain('forbiddenMarks: ["charlotte", "lasso"]');
    // Slate off: no Lasso, no loop, no spool.
    expect(guard).toContain("forbidden: /lasso/i");
    expect(guard).toContain('forbiddenMarks: ["lasso", "slate-spool"]');
    // Nothing is excused in either mode.
    expect(guard).toContain("const FLIP_ONLY: RegExp[] = [];");
    expect(guard).toContain("const USER_CONTENT: RegExp[] = [];");
    expect(guard).toContain("toHaveAttribute(");
  });
});
