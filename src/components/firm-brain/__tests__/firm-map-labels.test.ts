import { describe, expect, it } from "vitest";

import { crowdedLabels, labelRank, LABEL_GAP, type LabelBox } from "../firm-map-labels";

const box = (
  id: string,
  x: number,
  y: number,
  rank: number,
  width = 80,
  height = 14,
): LabelBox => ({
  id,
  x,
  y,
  width,
  height,
  rank,
});

describe("crowdedLabels", () => {
  it("hides nothing when there are no labels or only one", () => {
    expect(crowdedLabels([]).size).toBe(0);
    expect(crowdedLabels([box("a", 0, 0, 1)]).size).toBe(0);
  });

  it("keeps labels that clear each other", () => {
    expect(crowdedLabels([box("a", 0, 0, 1), box("b", 200, 0, 2), box("c", 0, 60, 3)]).size).toBe(
      0,
    );
  });

  it("hides the lower ranked of two that overlap, whatever order they arrive in", () => {
    const a = box("a", 100, 100, 1);
    const b = box("b", 130, 104, 2);
    expect([...crowdedLabels([a, b])]).toEqual(["b"]);
    expect([...crowdedLabels([b, a])]).toEqual(["b"]);
  });

  it("treats labels closer than the gap as overlapping, and labels just past it as clear", () => {
    const a = box("a", 0, 0, 1);
    expect(crowdedLabels([a, box("b", 80 + LABEL_GAP - 1, 0, 2)]).has("b")).toBe(true);
    expect(crowdedLabels([a, box("b", 80 + LABEL_GAP, 0, 2)]).has("b")).toBe(false);
  });

  it("leaves no two shown labels overlapping in a dense cluster", () => {
    const boxes = Array.from({ length: 40 }, (_, i) =>
      box(`n${i}`, 300 + ((i * 37) % 120), 200 + ((i * 53) % 60), i),
    );
    const hidden = crowdedLabels(boxes);
    const shown = boxes.filter((b) => !hidden.has(b.id));
    expect(shown.length).toBeGreaterThan(0);
    expect(hidden.has("n0")).toBe(false);
    for (const a of shown)
      for (const b of shown)
        if (a.id < b.id)
          expect(
            Math.abs(a.x - b.x) >= (a.width + b.width) / 2 + LABEL_GAP ||
              Math.abs(a.y - b.y) >= (a.height + b.height) / 2 + LABEL_GAP,
          ).toBe(true);
  });

  it("a hidden label does not push out others: only kept labels take space", () => {
    // b overlaps a and is hidden; c overlaps b only, so c stays.
    const hidden = crowdedLabels([box("a", 0, 0, 1), box("b", 60, 0, 2), box("c", 130, 0, 3)]);
    expect([...hidden]).toEqual(["b"]);
  });

  it("breaks rank ties by id so the answer is stable", () => {
    const one = crowdedLabels([box("b", 0, 0, 1), box("a", 10, 0, 1)]);
    const two = crowdedLabels([box("a", 10, 0, 1), box("b", 0, 0, 1)]);
    expect([...one]).toEqual(["b"]);
    expect([...two]).toEqual(["b"]);
  });

  it("never hides an unmeasured label and never lets it hide another", () => {
    const hidden = crowdedLabels([
      box("unmeasured", 0, 0, 1, 0, 0),
      box("a", 0, 0, 2),
      box("nan", Number.NaN, 0, 0),
    ]);
    expect(hidden.size).toBe(0);
  });
});

describe("labelRank", () => {
  const base = { dim: false, distance: 600, showing: false } as const;

  it("puts what the person pulled ahead of anything faded", () => {
    expect(labelRank({ ...base, kind: "method", distance: 3000 })).toBeLessThan(
      labelRank({ ...base, kind: "situation", dim: true, distance: 100 }),
    );
  });

  it("orders situations, then engagement names, then methods", () => {
    const s = labelRank({ ...base, kind: "situation", distance: 3900 });
    const d = labelRank({ ...base, kind: "deck", distance: 3900 });
    const m = labelRank({ ...base, kind: "method", distance: 10 });
    expect(s).toBeLessThan(d);
    expect(d).toBeLessThan(m);
  });

  it("prefers the nearer of two methods", () => {
    expect(labelRank({ ...base, kind: "method", distance: 500 })).toBeLessThan(
      labelRank({ ...base, kind: "method", distance: 700 }),
    );
  });

  it("lets a showing label hold on against a slightly nearer one, but not a much nearer one", () => {
    const showing = labelRank({ ...base, kind: "method", distance: 700, showing: true });
    expect(showing).toBeLessThan(labelRank({ ...base, kind: "method", distance: 600 }));
    expect(showing).toBeGreaterThan(labelRank({ ...base, kind: "method", distance: 300 }));
  });

  it("stays inside its kind's band at any distance", () => {
    expect(labelRank({ ...base, kind: "situation", distance: 1e9 })).toBeLessThan(
      labelRank({ ...base, kind: "deck", distance: 0, showing: true }) + 0.06,
    );
    expect(labelRank({ ...base, kind: "method", distance: -5 })).toBe(2);
  });
});
