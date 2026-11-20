// 21 Nov, D-85 PR B: the firm map as a turning sphere on Home. The same data always makes the same sphere; it is capped
// so an ordinary laptop keeps it smooth; asking turns it the short way to face the engagements quoted; fees appear
// only when the server sent them, so a member's sphere carries none.
import { describe, expect, it } from "vitest";

import { canvasDataFor, hasMoney } from "@/lib/firm-canvas-shared";
import {
  capThreads,
  facingAngle,
  fibonacciSphere,
  MAX_ORB_THREADS,
  orbModel,
  ORB_COPY,
  project,
  pulledPlace,
  rotate,
  shortestTurn,
} from "@/lib/firm-orb-shared";
import type { FirmGraph } from "@/lib/firm-graph-shared";
import { corpusOf, demoRows, graphOf } from "@/lib/__tests__/helpers/demo-firm-rows";

const corpus = corpusOf(demoRows());
const graph = graphOf(demoRows());
const member = canvasDataFor(graph, corpus, false);
const admin = canvasDataFor(graph, corpus, true);

describe("the sphere", () => {
  it("spreads points over a sphere of the given radius", () => {
    const points = fibonacciSphere(12, 1);
    expect(points).toHaveLength(12);
    for (const p of points) expect(Math.hypot(...p)).toBeCloseTo(1, 5);
    for (const p of fibonacciSphere(10, 0.42)) expect(Math.hypot(...p)).toBeCloseTo(0.42, 5);
  });

  it("puts every situation, method and engagement on it, the same way every time", () => {
    const model = orbModel(member);
    expect(model.situations).toHaveLength(member.situations.length);
    expect(model.methods).toHaveLength(member.methods.length);
    expect(model.threads).toHaveLength(member.threads.length);
    expect(JSON.stringify(orbModel(member).threads)).toBe(JSON.stringify(model.threads));
    for (const thread of model.threads) {
      expect(Math.hypot(...thread.end)).toBeGreaterThan(0.7);
      expect(Math.hypot(...thread.end)).toBeLessThan(1.2);
      expect(thread.points.length).toBeGreaterThan(10);
    }
  });

  it("gives a member's sphere no fee at all, and an admin's the fees the server sent", () => {
    const m = orbModel(member);
    expect(m.threads.every((thread) => thread.fee === null)).toBe(true);
    expect(JSON.stringify(m).split('"').filter(hasMoney)).toEqual([]);
    const a = orbModel(admin);
    expect(a.threads.filter((thread) => thread.fee).length).toBeGreaterThan(10);
  });
});

function big(count: number): FirmGraph {
  const threads = Array.from({ length: count }, (_, i) => ({
    ...graph.threads[i % graph.threads.length]!,
    id: `t${i}`,
    startedOn: `2020-01-${String((i % 28) + 1).padStart(2, "0")}`,
  }));
  return {
    ...graph,
    threads,
    situations: graph.situations.map((s) => ({
      ...s,
      threadIds: threads.filter((t) => t.situation === s.id).map((t) => t.id),
    })),
  };
}

describe("keeping it smooth", () => {
  it("draws at most 160 engagements, the most recent, and always the ones an answer quoted", () => {
    const data = canvasDataFor(big(500), corpus, false);
    expect(orbModel(data).threads.length).toBe(MAX_ORB_THREADS);
    const oldest = [...data.threads].sort((a, b) => a.startedOn.localeCompare(b.startedOn))[0]!;
    expect(orbModel(data).threads.some((t) => t.id === oldest.id)).toBe(false);
    expect(orbModel(data, new Set([oldest.id])).threads.some((t) => t.id === oldest.id)).toBe(true);
    expect(capThreads(graph.threads)).toHaveLength(graph.threads.length);
  });
});

describe("turning to the answer", () => {
  it("finds the angle that brings the quoted engagements to the front", () => {
    const model = orbModel(member);
    const ids = model.threads.slice(0, 2).map((t) => t.id);
    const angle = facingAngle(model, ids)!;
    for (const id of ids) {
      const end = model.threads.find((t) => t.id === id)!.end;
      expect(rotate(end, angle)[2]).toBeGreaterThan(rotate(end, angle + Math.PI)[2]);
    }
    expect(facingAngle(model, ["not-on-the-map"])).toBeNull();
  });

  it("always turns the short way round", () => {
    expect(shortestTurn(0, 1)).toBeCloseTo(1);
    expect(shortestTurn(0, 2 * Math.PI - 0.5)).toBeCloseTo(-0.5);
    for (let a = -10; a < 10; a += 0.7)
      for (let b = -10; b < 10; b += 0.9)
        expect(Math.abs(shortestTurn(a, b))).toBeLessThanOrEqual(Math.PI + 1e-9);
  });

  it("lines the pulled engagements up at the front, in the middle", () => {
    expect(pulledPlace(0, 1)).toEqual([0, -0.1, 1.02]);
    const row = [0, 1, 2].map((i) => pulledPlace(i, 3));
    expect(row[0]![0]).toBeLessThan(row[1]![0]);
    expect(row[1]![0]).toBeCloseTo(0);
    expect(row.every((p) => p[2] > 1)).toBe(true);
  });

  it("projects the centre of the sphere to the middle of the canvas", () => {
    expect(project([0, 0, 0], 400, 300)).toEqual({ x: 200, y: 150, z: 0, k: 1 });
  });
});

describe("words", () => {
  it("says what it does in plain words, never audit", () => {
    expect(ORB_COPY.hint).toContain("Every line of the answer shows where it came from");
    expect(ORB_COPY.found(1)).toBe("Found it in 1 engagement");
    expect(ORB_COPY.found(3)).toBe("Found it in 3 engagements");
    const all = JSON.stringify(ORB_COPY) + ORB_COPY.found(2);
    expect(all).not.toMatch(/audit|surveil|monitor|track|—|–/i);
  });
});
