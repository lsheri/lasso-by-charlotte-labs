import { describe, expect, expectTypeOf, it } from "vitest";
import { clampMentions, mentionedProfileIds, parseMentions, serializeMentions, type Mention } from "@/lib/mention-shared";
import { NOTIFICATION_COPY, NOTIFICATION_KINDS, type NotificationKind } from "@/lib/notifications-shared";

const mention: Mention = { profileId: "p1", label: "Liam", start: 0, length: 5 };

describe("MN1 mention storage", () => {
  it("round trips normalized mentions stably without mutating input", () => {
    const input = [{ ...mention, start: 12, label: " Liam " }, { ...mention, profileId: "p2", label: "Ana" }];
    const stored = serializeMentions(input);
    expect(stored).toEqual([{ ...mention, profileId: "p2", label: "Ana" }, { ...mention, start: 12 }]);
    expect(parseMentions(stored)).toEqual(stored);
    expect(serializeMentions(parseMentions(stored))).toEqual(stored);
    expect(input[0]?.label).toBe(" Liam ");
  });

  it.each([
    ["null", null],
    ["string", "mention"],
    ["numbers", [1, 2, 3]],
    ["missing profileId", [{ label: "Liam", start: 0, length: 5 }]],
    ["negative start", [{ ...mention, start: -1 }]],
    ["fractional length", [{ ...mention, length: 1.5 }]],
    ["blank profileId", [{ ...mention, profileId: "  " }]],
    ["blank label", [{ ...mention, label: "  " }]],
    ["infinite start", [{ ...mention, start: Infinity }]],
    ["NaN length", [{ ...mention, length: NaN }]],
  ])("reads %s without throwing", (_name, input) => {
    expect(() => parseMentions(input)).not.toThrow();
    expect(parseMentions(input)).toEqual([]);
  });

  it("drops only invalid siblings and tolerates unreadable entries", () => {
    const unreadable = { get profileId(): string { throw new Error("unreadable"); } };
    expect(parseMentions([null, { ...mention, start: -1 }, unreadable, mention])).toEqual([mention]);
  });

  it("normalizes invalid storage entries with the same reader checks", () => {
    expect(serializeMentions([{ ...mention, start: -1 }, { ...mention, label: " " }, mention])).toEqual([mention]);
  });

  it("drops later overlaps after sorting and keeps adjacent mentions", () => {
    const overlapping = { ...mention, profileId: "p2", start: 3 };
    const adjacent = { ...mention, profileId: "p3", start: 5 };
    expect(serializeMentions([adjacent, overlapping, mention])).toEqual([mention, adjacent]);
    expect(serializeMentions([mention, { ...mention, profileId: "p4" }])).toEqual([mention]);
  });

  it("accepts zero-length offsets as non-negative integers", () => {
    const empty = { ...mention, length: 0 };
    expect(parseMentions([empty])).toEqual([empty]);
    expect(serializeMentions([empty])).toEqual([empty]);
  });

  it("clamps mentions to plain text, keeping the exact end boundary", () => {
    expect(clampMentions([mention, { ...mention, start: 1 }], 5)).toEqual([mention]);
    expect(clampMentions([mention], 4)).toEqual([]);
  });

  it("deduplicates profile ids in first-appearance order", () => {
    expect(mentionedProfileIds([{ ...mention, profileId: "p2" }, mention, { ...mention, profileId: "p2" }])).toEqual(["p2", "p1"]);
  });

  it("keeps the notification union and ordered kind list exhaustive and unique", () => {
    const kinds = {
      invite_needs_approval: true,
      share_received: true,
      invite_decided: true,
      invite_accepted: true,
      seat_over_count: true,
      board_activity: true,
      support_request: true,
      mention_received: true,
    } satisfies Record<NotificationKind, true>;
    expectTypeOf<keyof typeof kinds>().toEqualTypeOf<NotificationKind>();
    expect(NOTIFICATION_KINDS).toEqual(Object.keys(kinds));
    expect(NOTIFICATION_KINDS).toContain("mention_received");
    expect(NOTIFICATION_KINDS).toHaveLength(Object.keys(kinds).length);
    expect(new Set(NOTIFICATION_KINDS).size).toBe(NOTIFICATION_KINDS.length);
  });

  it("uses the exact person-to-person mention sentence", () => {
    const sentence = NOTIFICATION_COPY.mentionSentence("Liam", "Pricing");
    expect(sentence).toBe("Liam mentioned you on Pricing.");
    expect(sentence).not.toMatch(/\b(track|monitor|activity|audit|analytics)\b|\u2014/i);
  });
});