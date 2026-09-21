import { describe, expect, it } from "vitest";
import { earliestSuppliedTs, pushSourceTimeFields } from "../push-source-time";

const at = (minutes: number) => new Date(Date.UTC(2026, 0, 2, 9, minutes)).toISOString();

describe("push source time", () => {
  it("takes the earliest supplied time and says the precision is source", () => {
    const supplied = [at(40), null, at(5), undefined, at(25)];
    const times = supplied.filter((v): v is string => typeof v === "string");
    const expected = times.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b));
    const fields = pushSourceTimeFields(null, supplied);
    expect(fields.created_at_source).toBe(expected);
    expect(Date.parse(fields.created_at_source!)).toBe(
      Math.min(...times.map((t) => Date.parse(t))),
    );
    expect(fields.ts_precision).toBe("source");
    expect(fields.work_date).toBe(expected.slice(0, 10));
  });

  it("records nothing when nobody supplied a time", () => {
    const fields = pushSourceTimeFields(null, [null, undefined, "", "not a date"]);
    expect(fields.created_at_source).toBeNull();
    expect(fields.work_date).toBeNull();
    expect(fields.ts_precision).toBe("capture");
  });

  it("keeps the recorded date when a later window is later, moves when it is earlier", () => {
    const recorded = at(30);
    const later = pushSourceTimeFields({ created_at_source: recorded }, [at(55), at(70)]);
    expect(later.created_at_source).toBe(recorded);

    const earlierWindow = [at(2), at(9)];
    const earlier = pushSourceTimeFields({ created_at_source: recorded }, earlierWindow);
    const all = [recorded, ...earlierWindow];
    expect(Date.parse(earlier.created_at_source!)).toBe(
      Math.min(...all.map((t) => Date.parse(t))),
    );
  });

  it("returns the value as supplied, not a reformatting of it", () => {
    const supplied = ["2026-03-04T05:06:07.000Z", "2026-03-05T05:06:07.000Z"];
    expect(earliestSuppliedTs(supplied)).toBe(supplied[0]);
  });
});
