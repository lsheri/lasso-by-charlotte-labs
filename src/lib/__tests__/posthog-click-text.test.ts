// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://lasso.charlotte-labs.com/proposals" }
// 20 Nov 2026 (Liam, Q-59): the browser's own click capture sent the visible words of whatever was clicked: client
// names, titles, email addresses. A click is still counted; nothing that was on the screen goes with it. The first
// group builds a click with PostHog's real script and passes it through our hook, so the proof does not rest on our
// own idea of what the script sends.
import { describe, expect, it } from "vitest";
import type { BeforeSendFn, CaptureResult } from "posthog-js";
import { autocapturePropertiesForElement } from "posthog-js/lib/src/autocapture";

import { bareElementsChain, CLICK_EVENTS, isLocalHost, POSTHOG_CONFIG, stripClickText } from "../posthog-client";

const hook = POSTHOG_CONFIG.before_send as BeforeSendFn;
const SECRETS = ["Larkspur", "Christy", "Johnson", "christy.johnson@larkspur.test", "Staffing model review", "mailto", "larkspur.test", "Open Christy", "secret-value", "lead-christy"];

function page(): HTMLElement {
  document.body.innerHTML = `
    <main id="lead-christy" title="Larkspur Senior Living" class="desk larkspur-row">
      <section aria-label="Staffing model review for Christy Johnson" data-testid="proposal-row">
        <a href="mailto:christy.johnson@larkspur.test?subject=Staffing model review" title="Open Christy" class="link">
          <span>Christy Johnson</span> at Larkspur; she said "yes"
        </a>
        <button type="button" name="Christy" value="secret-value" aria-label="Ask Christy Johnson to lead"><span>Ask Christy Johnson to lead</span></button>
      </section>
    </main>`;
  return document.body;
}

function realClick(selector: string, masked: boolean): Record<string, unknown> {
  const target = page().querySelector(selector) as HTMLElement;
  const { props } = autocapturePropertiesForElement(target, {
    e: new MouseEvent("click"),
    maskAllElementAttributes: masked,
    maskAllText: masked,
    elementAttributeIgnoreList: [],
    elementsChainAsString: false,
    disableCaptureUrlHashes: false,
  });
  return props as Record<string, unknown>;
}

function send(event: string, properties: Record<string, unknown>): CaptureResult | null {
  return hook({ uuid: "test", event, properties: { ...properties, $current_url: "https://lasso.charlotte-labs.com/proposals" } } as CaptureResult);
}

describe("a click, built by PostHog's own script", () => {
  it("is told to read no text and no attributes", () => {
    expect(POSTHOG_CONFIG.mask_all_text).toBe(true);
    expect(POSTHOG_CONFIG.mask_all_element_attributes).toBe(true);
    expect(POSTHOG_CONFIG.autocapture).toBe(true);
  });

  it("without our hook the script really does send the words, which is what this fix is for", () => {
    const raw = JSON.stringify(realClick("button", false));
    expect(raw).toContain("Ask Christy Johnson to lead");
    expect(JSON.stringify(realClick("a span", false))).toContain("christy.johnson@larkspur.test");
  });

  it("even with masking on, the script still adds a link's address, so masking alone is not enough", () => {
    expect(JSON.stringify(realClick("a span", true))).toContain("christy.johnson@larkspur.test");
  });

  it.each(CLICK_EVENTS.flatMap((event) => [[event, "button", true], [event, "a span", true], [event, "button", false], [event, "a span", false]] as const))(
    "%s on %s (masking %s) leaves our hook with no name, title, label, value, address or class",
    (event, selector, masked) => {
      const sent = send(event, realClick(selector, masked));
      const text = JSON.stringify(sent);
      for (const secret of SECRETS) expect(text).not.toContain(secret);
      expect(text).not.toContain("@");
      const properties = sent!.properties as Record<string, unknown>;
      expect(properties).not.toHaveProperty("$el_text");
      expect(properties).not.toHaveProperty("$external_click_url");
      // The click itself is kept: what kind of thing, and where it sat.
      expect(String(properties["$elements_chain"])).toMatch(selector === "button" ? /^button:nth-child="2"nth-of-type="1";section:/ : /^span:nth-child="1"nth-of-type="1";a:/);
      expect(properties["$elements_chain"]).toMatch(/^(?:[a-z][a-z0-9-]*(?::nth-child="\d+"nth-of-type="\d+")?(?:;|$))+$/);
      expect((properties["$elements"] as unknown[])[0]).toEqual(selector === "button" ? { tag_name: "button", nth_child: 2, nth_of_type: 1 } : { tag_name: "span", nth_child: 1, nth_of_type: 1 });
      expect(properties["$current_url"]).toBe("https://lasso.charlotte-labs.com/proposals");
      expect(properties["$event_type"]).toBe("click");
    },
  );
});

describe("the element chain is rebuilt, never trimmed", () => {
  it.each([
    ['button.btn.primary:attr__aria-label="Ask Christy"nth-child="2"nth-of-type="1"text="Ask Christy"', 'button:nth-child="2"nth-of-type="1"'],
    ['a:attr__href="mailto:a@b.co"href="mailto:a@b.co"nth-child="1"nth-of-type="1";div:nth-child="3"nth-of-type="2"', 'a:nth-child="1"nth-of-type="1";div:nth-child="3"nth-of-type="2"'],
    // A value holding a semicolon, an escaped quote and what looks like another element stays inside its quotes.
    ['span:nth-child="1"nth-of-type="1"text="x; div:nth-child=\\"9\\" Christy";li:nth-child="4"nth-of-type="4"', 'span:nth-child="1"nth-of-type="1";li:nth-child="4"nth-of-type="4"'],
    // A value that pretends to be a position cannot move the real one.
    ['p:attr__title="nth-child=\\"7\\"nth-of-type=\\"7\\""nth-child="2"nth-of-type="1"', 'p:nth-child="2"nth-of-type="1"'],
    ['custom-card.x:attr__data-name="Larkspur"', "custom-card"],
    ['Christy Johnson;:text="Larkspur";@;button:nth-child="1"nth-of-type="1"', 'button:nth-child="1"nth-of-type="1"'],
    ["", ""],
  ])("%s", (chain, kept) => {
    expect(bareElementsChain(chain)).toBe(kept);
  });

  it.each([null, undefined, 4, {}, ["button"], "x".repeat(100_001)])("anything that is not a sane chain becomes empty (%#)", (chain) => {
    expect(bareElementsChain(chain)).toBe("");
  });

  it("drops elements with no usable kind and every other key on an element", () => {
    const kept = stripClickText({
      $el_text: "Christy", $external_click_url: "https://larkspur.test", $selected_content: "copied words", $copy_type: "copy",
      $elements: [{ tag_name: "BUTTON", $el_text: "Christy", attr__id: "lead-christy", classes: ["larkspur"], nth_child: 2, nth_of_type: 1 }, { tag_name: 7 }, null, { tag_name: "div", nth_child: "3" }],
    });
    expect(kept).toEqual({ $copy_type: "copy", $elements: [{ tag_name: "button", nth_child: 2, nth_of_type: 1 }, { tag_name: "div" }] });
  });
});

describe("other events and other protections are untouched", () => {
  it("leaves a named event's own properties alone and still redacts share links", () => {
    const sent = send("$pageview", { $el_text: "kept, this is not a click event", link: "/memo/live-secret" });
    expect(sent!.properties).toMatchObject({ $el_text: "kept, this is not a click event", link: "/memo/:token" });
  });

  it("replay still hides every piece of text", () => {
    expect(POSTHOG_CONFIG.session_recording).toEqual({ maskAllInputs: true, maskTextSelector: "*", blockSelector: "img, svg, canvas, video, embed, object, iframe, picture" });
  });

  it("knows this machine from everywhere else", () => {
    for (const host of ["localhost", "127.0.0.1", "LOCALHOST", "localhost:3198"]) expect(isLocalHost(host)).toBe(true);
    for (const host of ["lasso.charlotte-labs.com", "localhost.attacker.com", "id-preview--x.lovable.app", "", null, undefined]) expect(isLocalHost(host)).toBe(false);
  });
});
