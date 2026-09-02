import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  captureContextDims,
  detectLanguage,
  durationBand,
  freshnessBand,
  hourBand,
  isWeekday,
  lenBand,
  machineLabel,
  medianLength,
  modalityFlags,
  pushSizeBand,
  toolUseCounts,
} from "@/lib/capture-census";
import { MODEL_FAMILIES, modelRawOf, modelSwitched, normalizeModelId } from "@/lib/model-registry";

describe("pass 155: model registry", () => {
  it("keeps raw identifiers verbatim and names undisclosed", () => {
    expect(modelRawOf("gpt-4o-2024-11-20")).toBe("gpt-4o-2024-11-20");
    expect(modelRawOf("  claude-opus-4-1 ")).toBe("claude-opus-4-1");
    expect(modelRawOf(null)).toBe("undisclosed");
    expect(modelRawOf("")).toBe("undisclosed");
  });

  it("normalizes known families", () => {
    expect(normalizeModelId("gpt-4o-2024-11-20")).toBe("gpt-4o");
    expect(normalizeModelId("gpt-5.1-thinking")).toBe("gpt-5");
    expect(normalizeModelId("o3-mini")).toBe("o3");
    expect(normalizeModelId("claude-opus-4-1")).toBe("claude-opus");
    expect(normalizeModelId("claude-3-5-sonnet-20241022")).toBe("claude-sonnet");
    expect(normalizeModelId("models/gemini-2.5-flash")).toBe("gemini-flash");
    expect(normalizeModelId("gemini-1.5-pro")).toBe("gemini-pro");
    expect(normalizeModelId("llama-3.3-70b")).toBe("llama");
    expect(normalizeModelId("mistral-large-latest")).toBe("mistral");
  });

  it("never throws and answers unrecognized for unknown input", () => {
    expect(normalizeModelId("zzz-internal-build-9")).toBe("unrecognized");
    expect(normalizeModelId(undefined)).toBe("undisclosed");
    expect(normalizeModelId({} as unknown)).toBe("undisclosed");
    expect(MODEL_FAMILIES).toContain(normalizeModelId(42 as unknown));
  });

  it("sees a switch only across distinct disclosed identifiers", () => {
    expect(modelSwitched(["gpt-4o", "gpt-4o"])).toBe(false);
    expect(modelSwitched(["gpt-4o", null])).toBe(false);
    expect(modelSwitched([null, undefined])).toBe(false);
    expect(modelSwitched(["gpt-4o", "o3-mini"])).toBe(true);
  });
});

describe("pass 155: band edges", () => {
  it("length bands land exactly on their edges", () => {
    expect(lenBand(0)).toBe("0-100");
    expect(lenBand(100)).toBe("0-100");
    expect(lenBand(101)).toBe("101-400");
    expect(lenBand(400)).toBe("101-400");
    expect(lenBand(401)).toBe("401-1500");
    expect(lenBand(1500)).toBe("401-1500");
    expect(lenBand(1501)).toBe("1501-5000");
    expect(lenBand(5000)).toBe("1501-5000");
    expect(lenBand(5001)).toBe("5000+");
    expect(lenBand(Number.NaN)).toBe("0-100");
  });

  it("takes the lower median", () => {
    expect(medianLength([10, 20, 30])).toBe(20);
    expect(medianLength([10, 20, 30, 40])).toBe(20);
    expect(medianLength([])).toBe(0);
  });

  it("duration bands", () => {
    const base = "2026-01-05T00:00:00.000Z";
    const plus = (min: number) =>
      new Date(Date.parse(base) + min * 60000).toISOString();
    expect(durationBand(base, plus(4))).toBe("under_5m");
    expect(durationBand(base, plus(5))).toBe("5-30m");
    expect(durationBand(base, plus(30))).toBe("5-30m");
    expect(durationBand(base, plus(31))).toBe("30m-2h");
    expect(durationBand(base, plus(120))).toBe("30m-2h");
    expect(durationBand(base, plus(121))).toBe("2h-1d");
    expect(durationBand(base, plus(1440))).toBe("2h-1d");
    expect(durationBand(base, plus(1441))).toBe("1d+");
    expect(durationBand(base, "not a date")).toBe("unknown");
    expect(durationBand(null, null)).toBe("unknown");
  });

  it("freshness bands", () => {
    const base = "2026-01-05T00:00:00.000Z";
    const plus = (h: number) => new Date(Date.parse(base) + h * 3600000).toISOString();
    expect(freshnessBand(base, plus(0.5))).toBe("under_1h");
    expect(freshnessBand(base, plus(1))).toBe("1h-1d");
    expect(freshnessBand(base, plus(24))).toBe("1h-1d");
    expect(freshnessBand(base, plus(25))).toBe("1-7d");
    expect(freshnessBand(base, plus(24 * 7))).toBe("1-7d");
    expect(freshnessBand(base, plus(24 * 7 + 1))).toBe("7d+");
    expect(freshnessBand("nope", plus(1))).toBe("unknown");
  });

  it("push size bands", () => {
    expect(pushSizeBand(9_999)).toBe("under_10k");
    expect(pushSizeBand(10_000)).toBe("10-100k");
    expect(pushSizeBand(99_999)).toBe("10-100k");
    expect(pushSizeBand(100_000)).toBe("100k-1m");
    expect(pushSizeBand(999_999)).toBe("100k-1m");
    expect(pushSizeBand(1_000_000)).toBe("1m+");
  });

  it("hour bands and weekday, UTC", () => {
    expect(hourBand("2026-01-05T05:59:00.000Z")).toBe("0-5");
    expect(hourBand("2026-01-05T06:00:00.000Z")).toBe("6-11");
    expect(hourBand("2026-01-05T17:59:00.000Z")).toBe("12-17");
    expect(hourBand("2026-01-05T18:00:00.000Z")).toBe("18-23");
    expect(hourBand("junk")).toBe("unknown");
    // 2026-01-05 is a Monday, 2026-01-04 a Sunday.
    expect(isWeekday("2026-01-05T12:00:00.000Z")).toBe(true);
    expect(isWeekday("2026-01-04T12:00:00.000Z")).toBe(false);
  });
});

describe("pass 155: structure detection", () => {
  const turns = [
    { role: "user", content: "Please review report.pdf and the chart.png" },
    { role: "assistant", content: "```ts\nconst a = 1;\n```\n\n| a | b |\n| --- | --- |\n| 1 | 2 |" },
    { role: "tool", content: "web_search results" },
    { role: "tool", content: "opaque output" },
  ];

  it("reads modality from structure only", () => {
    expect(modalityFlags(turns)).toEqual({
      had_files: true,
      had_images: true,
      had_code_blocks: true,
      had_tables: true,
    });
    expect(modalityFlags([])).toEqual({
      had_files: false,
      had_images: false,
      had_code_blocks: false,
      had_tables: false,
    });
  });

  it("counts tool use by kind", () => {
    const counts = toolUseCounts(turns);
    expect(counts.web_search).toBe(1);
    expect(counts.other).toBe(1);
    expect(counts.file_tools).toBe(0);
  });

  it("guesses a language code or und", () => {
    expect(
      detectLanguage([
        { role: "user", content: "the plan and the budget that you have with this team" },
      ]),
    ).toBe("en");
    expect(detectLanguage([{ role: "user", content: "..." }])).toBe("und");
    expect(detectLanguage([])).toBe("und");
  });

  it("refuses anything that is not a machine label", () => {
    expect(machineLabel("claude-desktop")).toBe("claude-desktop");
    expect(machineLabel("1.4.2")).toBe("1.4.2");
    expect(machineLabel("please write me a plan for the quarter")).toBe("unknown");
    expect(machineLabel(null)).toBe("unknown");
  });
});

describe("pass 155: capture.context payload", () => {
  const secret = "Quarterly pricing memo for Northwind, confidential";
  const turns = [
    { role: "user", content: secret, ts: "2026-01-05T09:00:00.000Z" },
    { role: "assistant", content: `${secret} answered at length`, ts: "2026-01-05T09:40:00.000Z" },
  ];

  const dims = captureContextDims({
    turns,
    clientName: "claude-desktop",
    clientVersion: "1.4.2",
    protocolVersion: "2025-11-25",
    bytes: 42_000,
    pushedAt: "2026-01-05T10:00:00.000Z",
  });

  it("bands and codes only", () => {
    expect(dims["client_name"]).toBe("claude-desktop");
    expect(dims["protocol_version"]).toBe("2025-11-25");
    expect(dims["duration_band"]).toBe("30m-2h");
    expect(dims["freshness_band"]).toBe("under_1h");
    expect(dims["push_size_band"]).toBe("10-100k");
    expect(dims["hour_band"]).toBe("6-11");
    expect(dims["weekday"]).toBe(true);
  });

  it("no dim value ever contains a substring of turn content", () => {
    const words = secret.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    for (const value of Object.values(dims)) {
      if (typeof value !== "string") continue;
      for (const word of words) {
        expect(value.toLowerCase()).not.toContain(word);
      }
    }
  });

  it("degrades to unknown buckets instead of throwing", () => {
    const empty = captureContextDims({ turns: [] });
    expect(empty["client_name"]).toBe("unknown");
    expect(empty["duration_band"]).toBe("unknown");
    expect(empty["language"]).toBe("und");
    expect(empty["prompt_len_band"]).toBe("0-100");
  });
});

describe("pass 155: wiring", () => {
  it("emits capture.context next to thread.shape, only for new conversations", () => {
    const mcp = readFileSync("src/lib/mcp-handler.server.ts", "utf8");
    expect(mcp).toContain("noteCaptureContext");
    expect(mcp).toContain("capture-census.server");
    const taxonomy = readFileSync("src/lib/work-taxonomy.functions.ts", "utf8");
    expect(taxonomy).toContain("noteCaptureContext");
  });

  it("registers the event name additively", () => {
    const shared = readFileSync("src/lib/telemetry-shared.ts", "utf8");
    expect(shared).toContain('"capture.context"');
    expect(shared).toContain('"thread.shape"');
    expect(shared).toContain('"model.used"');
  });

  it("model.used carries the additive model dims", () => {
    const server = readFileSync("src/lib/work-taxonomy.server.ts", "utf8");
    expect(server).toContain("model_raw");
    expect(server).toContain("model_id");
    expect(server).toContain("model_switched");
    expect(server).toContain("vendor:");
    expect(server).toContain("task_class:");
  });
});
