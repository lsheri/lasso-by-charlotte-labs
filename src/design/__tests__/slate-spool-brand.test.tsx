import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  SPOOL_CORE,
  SPOOL_FLANGES,
  SPOOL_THREAD,
  SpoolScriptMark,
  spoolWeights,
} from "@/design/brand/SpoolScriptMark";
import { BrandLockup, BrandMark } from "@/components/layout/BrandLockup";
import { BrandVariantContext, SkinContext } from "@/components/skin/use-skin";
import { BRANDS, brandCopy, brandFor, launchBrand } from "@/design/brand/brand";
import {
  DEFAULT_BRAND_VARIANT,
  parseBrandVariant,
  resolveBrandVariant,
  variantFromBrandParam,
  type BrandVariant,
} from "@/lib/brand-variant-shared";
import type { Skin } from "@/lib/skin";

const tokens = readFileSync("src/design/tokens.css", "utf8");
const scope = tokens.slice(tokens.indexOf('[data-brand-theme="slate-spool"]'));
const value = (name: string) => new RegExp(`${name}:(#[0-9A-Fa-f]{6})`).exec(scope)?.[1] ?? "";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function under(skin: Skin, variant: BrandVariant, node: React.ReactNode): string {
  return renderToStaticMarkup(
    <SkinContext.Provider value={skin}>
      <BrandVariantContext.Provider value={variant}>{node}</BrandVariantContext.Provider>
    </SkinContext.Provider>,
  );
}

describe("Slate tokens", () => {
  it("sets the brief's values on the skin's own names, and renames nothing", () => {
    expect(value("--skin-page")).toBe("#ECEEF0");
    expect(value("--skin-ink")).toBe("#1E2933");
    expect(value("--skin-text-2")).toBe("#545F69");
    expect(value("--skin-live")).toBe("#04F85B");
    const names = [...scope.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]);
    const skinNames = readFileSync("src/design/skins/charlotte.css", "utf8");
    for (const name of names) expect(skinNames, name).toContain(`${name}:`);
  });

  it("only applies where a skin applies: inside the app shell and its overlays", () => {
    const selectors = scope
      .slice(0, scope.indexOf("{"))
      .split(",")
      .map((s) => s.trim());
    expect(selectors.length).toBe(6);
    for (const s of selectors)
      expect(s).toMatch(/^\[data-brand-theme="slate-spool"\]\[data-skin\] .*\[data-lasso="on"\]/);
  });

  it("text holds 4.5:1 on every Slate surface, and lime is never text", () => {
    const surfaces = [value("--skin-page"), value("--skin-raised"), value("--skin-sunk")];
    for (const bg of surfaces) {
      expect(contrast(value("--skin-ink"), bg), `ink on ${bg}`).toBeGreaterThanOrEqual(7);
      expect(contrast(value("--skin-text-2"), bg), `muted on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(value("--skin-text-3"), bg), `muted on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(value("--skin-ink"), value("--skin-page"))).toBeCloseTo(12.7, 1);
    expect(contrast(value("--skin-text-2"), value("--skin-page"))).toBeCloseTo(5.6, 1);
    expect(contrast(value("--skin-live"), value("--skin-page"))).toBeLessThan(3);
  });

  it("the kind inks the skin keeps still read on Slate", () => {
    const skin = readFileSync("src/design/skins/charlotte.css", "utf8");
    for (const kind of ["talk", "words", "numbers", "slides", "visual", "code"]) {
      const ink = new RegExp(`--t-${kind}:(#[0-9A-Fa-f]{6})`).exec(skin)?.[1] ?? "";
      for (const bg of [value("--skin-page"), value("--skin-raised"), value("--skin-sunk")])
        expect(contrast(ink, bg), `${kind} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("Spool script mark", () => {
  it("draws the spec's paths on a 64 grid, tagged for the brand registry", () => {
    const html = renderToStaticMarkup(<SpoolScriptMark size={64} />);
    expect(html).toContain('viewBox="0 0 64 64"');
    expect(html).toContain(`d="${SPOOL_FLANGES}"`);
    expect(html).toContain(`d="${SPOOL_CORE}"`);
    expect(html).toContain(`d="${SPOOL_THREAD}"`);
    expect(html).toContain('data-brand-mark="slate-spool"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("uses the spec's weights above 24px and the heavier ones at 24px and below", () => {
    expect(spoolWeights(64)).toMatchObject({
      main: 1.98,
      fine: 0.99,
      thread: 3.4,
      outline: 6,
      core: true,
    });
    expect(spoolWeights(25)).toMatchObject({ main: 1.98, thread: 3.4 });
    expect(spoolWeights(24)).toMatchObject({
      main: 3.9,
      fine: 2.55,
      thread: 4.6,
      outline: 7.8,
      core: true,
    });
  });

  it("drops the core lines at 16px and below, where they close up with the thread", () => {
    expect(spoolWeights(16).core).toBe(false);
    expect(spoolWeights(12).core).toBe(false);
    expect(renderToStaticMarkup(<SpoolScriptMark size={16} />)).not.toContain(SPOOL_CORE);
  });

  it("rest has no lime and no outline; the logo, live and drawing put an ink outline under the lime thread", () => {
    const rest = renderToStaticMarkup(<SpoolScriptMark size={24} state="rest" />);
    expect(rest).toContain('data-spool-state="rest"');
    expect(rest).not.toContain('class="spool-outline"');
    for (const state of ["logo", "live", "drawing"] as const) {
      const html = renderToStaticMarkup(<SpoolScriptMark size={24} state={state} />);
      expect(html).toContain(`data-spool-state="${state}"`);
      expect(html.indexOf('class="spool-outline"')).toBeGreaterThan(-1);
      expect(html.indexOf('class="spool-outline"')).toBeLessThan(
        html.indexOf('class="spool-thread"'),
      );
      expect(html).toContain('pathLength="1"');
    }
    expect(renderToStaticMarkup(<SpoolScriptMark size={24} state="live" onDark />)).not.toContain(
      'class="spool-outline"',
    );
  });

  it("only live states colour the thread, the draw runs once, and reduced motion shows it still", () => {
    const css = readFileSync("src/design/brand/spool-script-mark.css", "utf8");
    expect(css).toMatch(/\.spool-thread\{stroke:var\(--spool-ink\)/);
    expect(css).toMatch(
      /\[data-spool-state="logo"\],\[data-spool-state="live"\],\[data-spool-state="drawing"\]\) \.spool-thread\{stroke:var\(--spool-live\)\}/,
    );
    expect(css).toContain("--spool-live:var(--live)");
    expect(css).toMatch(/animation:spool-draw \.9s ease-in-out both/);
    expect(css).toMatch(/prefers-reduced-motion:reduce\)\{[^}]*animation:none/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});

describe("the brand switch", () => {
  it("uses its own attribute, so the reskin audit's vendor exemption ([data-brand]) never covers the whole page", () => {
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    const provider = readFileSync("src/components/skin/BrandVariantProvider.tsx", "utf8");
    expect(root).toContain("data-brand-theme={");
    expect(root).not.toMatch(/data-brand=\{/);
    expect(provider).toContain('setAttribute("data-brand-theme"');
    expect(provider).not.toContain('"data-brand"');
  });

  it("ships with Slate / Spool script as the default (19 Nov, Liam's D-1), named Lasso wherever the server speaks", () => {
    expect(DEFAULT_BRAND_VARIANT).toBe("slate-spool");
    expect(launchBrand().name).toBe("Lasso");
    expect(launchBrand().wordmark).toBe("LASSO");
    expect(launchBrand().look.mark).toBe("spool");
    // The earlier look is one argument away, for the one-line way back.
    expect(launchBrand(true, "current").name).toBe("Charlotte");
  });

  it("reads the choice from ?brand= and from the cookie value", () => {
    expect(variantFromBrandParam("?brand=slate-spool")).toBe("slate-spool");
    expect(variantFromBrandParam("?brand=charlotte")).toBe("current");
    expect(variantFromBrandParam("?brand=current")).toBe("current");
    expect(variantFromBrandParam("?brand=lasso")).toBeNull();
    expect(variantFromBrandParam("?brand=<script>")).toBeNull();
    expect(variantFromBrandParam("")).toBeNull();
    expect(parseBrandVariant("slate-spool")).toBe("slate-spool");
    expect(parseBrandVariant("current")).toBe("current");
    expect(parseBrandVariant("anything")).toBeNull();
    expect(parseBrandVariant(undefined)).toBeNull();
  });

  it("lets only allowed accounts and signed-out preview hosts leave the default", () => {
    // The rule itself, shown against the earlier default so "refused" and "allowed" give different answers.
    const ask = { stored: null, requested: "slate-spool" as const, fallback: "current" as const };
    expect(
      resolveBrandVariant({
        ...ask,
        email: "qa.company.admin@qaprobe.test",
        host: "lasso.charlotte-labs.com",
      }),
    ).toBe("slate-spool");
    expect(
      resolveBrandVariant({
        ...ask,
        email: "someone@charlotte-labs.com",
        host: "lasso.charlotte-labs.com",
      }),
    ).toBe("slate-spool");
    expect(
      resolveBrandVariant({
        ...ask,
        email: "quinn@kestrelbay.test",
        host: "lasso.charlotte-labs.com",
      }),
    ).toBe("current");
    expect(resolveBrandVariant({ ...ask, email: null, host: "lasso.charlotte-labs.com" })).toBe(
      "current",
    );
    expect(resolveBrandVariant({ ...ask, email: null, host: "127.0.0.1" })).toBe("slate-spool");
    // A hand-set cookie is no more than a request.
    expect(
      resolveBrandVariant({
        stored: "slate-spool",
        requested: null,
        email: "quinn@kestrelbay.test",
        host: "lasso.charlotte-labs.com",
        fallback: "current",
      }),
    ).toBe("current");
    expect(
      resolveBrandVariant({
        stored: "slate-spool",
        requested: null,
        email: null,
        host: "lasso.charlotte-labs.com",
        fallback: "current",
      }),
    ).toBe("current");
  });

  it("keeps a saved choice, and lets a request change it either way", () => {
    const who = {
      email: "qa.company.admin@qaprobe.test",
      host: "lasso.charlotte-labs.com",
      fallback: "current" as const,
    };
    expect(resolveBrandVariant({ stored: "slate-spool", requested: null, ...who })).toBe(
      "slate-spool",
    );
    expect(resolveBrandVariant({ stored: "slate-spool", requested: "current", ...who })).toBe(
      "current",
    );
    expect(resolveBrandVariant({ stored: null, requested: null, ...who })).toBe("current");
  });

  it("now the default has flipped, everyone gets Slate and only allowed accounts can still reach the old look", () => {
    // No fallback passed: this reads the real default.
    const flipped = { host: "lasso.charlotte-labs.com" };
    // ?brand=charlotte, or an old cookie, does nothing for anyone else on the live site.
    for (const email of ["quinn@kestrelbay.test", null])
      for (const [stored, requested] of [
        [null, "current"],
        ["current", null],
      ] as const)
        expect(resolveBrandVariant({ stored, requested, email, ...flipped })).toBe("slate-spool");
    expect(
      resolveBrandVariant({
        stored: null,
        requested: null,
        email: "quinn@kestrelbay.test",
        ...flipped,
      }),
    ).toBe("slate-spool");
    expect(resolveBrandVariant({ stored: null, requested: null, email: null, ...flipped })).toBe(
      "slate-spool",
    );
    expect(
      resolveBrandVariant({
        stored: null,
        requested: "current",
        email: "qa.company.admin@qaprobe.test",
        ...flipped,
      }),
    ).toBe("current");
    expect(
      resolveBrandVariant({
        stored: "current",
        requested: null,
        email: "qa.company.admin@qaprobe.test",
        ...flipped,
      }),
    ).toBe("current");
  });
});

describe("the brand in each variant", () => {
  it("the current variant returns each skin's brand untouched", () => {
    expect(brandFor("charlotte")).toBe(BRANDS.charlotte);
    expect(brandFor("charlotte", "current")).toBe(BRANDS.charlotte);
    expect(brandFor("lasso", "current")).toBe(BRANDS.lasso);
  });

  it("Slate / Spool script is a whole brand named Lasso; only the drawn glyph sets stay the skin's", () => {
    const brand = brandFor("charlotte", "slate-spool");
    expect(brand).toEqual({
      name: "Lasso",
      wordmark: "LASSO",
      askLabel: "Ask Lasso",
      look: { ...BRANDS.charlotte.look, mark: "spool" },
    });
  });

  it("the app's own copy follows the name, so a sentence can never disagree with the lockup", () => {
    const slate = brandFor("charlotte", "slate-spool");
    for (const text of [
      "WHAT LASSO READS",
      "Ask Lasso",
      "Ask Lasso about this",
      "Lasso is reading",
      "Sign in to Lasso",
    ]) {
      expect(brandCopy(slate, text)).toBe(text);
      expect(brandCopy(BRANDS.charlotte, text)).not.toMatch(/lasso/i);
    }
    expect(brandCopy(BRANDS.charlotte, "WHAT LASSO READS")).toBe("WHAT CHARLOTTE READS");
  });

  it("never touches the original Lasso skin", () => {
    expect(brandFor("lasso", "slate-spool")).toBe(BRANDS.lasso);
  });

  it("the lockup shows the spool logo, lime thread over an ink line, beside LASSO only under Slate / Spool script", () => {
    const slate = under("charlotte", "slate-spool", <BrandLockup size="sm" />);
    expect(slate).toContain('data-brand-mark="slate-spool"');
    // 19 Nov, Liam: the main logo carries the lime thread. Lime is the logo here, not a sign of work.
    expect(slate).toContain('data-spool-state="logo"');
    expect(slate).toContain('class="spool-outline"');
    expect(slate).toContain('data-skin-mark="spool"');
    expect(slate).toContain(">LASSO<");
    expect(slate).toContain("gap:5.28px");
    expect(slate).toContain("tracking-[0.22em]");
    expect(slate).not.toContain("data-charlotte-mark");

    const current = under("charlotte", "current", <BrandLockup size="sm" />);
    expect(current).toContain('data-brand-mark="charlotte"');
    expect(current).toContain(">CHARLOTTE<");
    expect(current).not.toContain("spool");
  });

  it("the still mark fills the block the switch sizes, at each lockup size", () => {
    for (const px of [24, 32, 40]) {
      const html = under("charlotte", "slate-spool", <BrandMark px={px} />);
      expect(html).toContain(`width:${px}px;height:${px}px`);
      expect(html).toContain(`data-size="${px}"`);
    }
  });
});
