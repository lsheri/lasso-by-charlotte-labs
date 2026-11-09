import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  granolaSpeakerLabel,
  granolaSpeakerNote,
  granolaSpeakers,
  renderGranolaTranscript,
} from "@/lib/granola.server";

const note = {
  owner: { name: "Liam Sheridan", email: "liam@charlotte-labs.com" },
  attendees: [
    { name: "Liam Sheridan", email: "liam@charlotte-labs.com" },
    { name: "Roger Tsai", email: "roger.tsai@artemisconnection.com" },
  ],
};

describe("GRANOLA-1 who the audio sources stand for", () => {
  it("the recorder is the note's owner; call audio is the one other attendee", () => {
    expect(granolaSpeakers(note)).toEqual({ recorder: "Liam Sheridan", other: "Roger Tsai" });
  });
  it("with two or more others, call audio is not given one person's name", () => {
    const many = {
      ...note,
      attendees: [...note.attendees, { name: "Ben Stanton", email: "ben@x.com" }],
    };
    expect(granolaSpeakers(many).other).toBeNull();
  });
  it("no owner or attendees: no names invented", () => {
    expect(granolaSpeakers({})).toEqual({ recorder: null, other: null });
  });
});

describe("GRANOLA-1 one line's label, from Granola's speaker object", () => {
  const who = { recorder: "Liam Sheridan", other: "Roger Tsai" };
  it("microphone is the recorder, speaker is the other person", () => {
    expect(granolaSpeakerLabel({ source: "microphone" }, who)).toBe("Liam Sheridan");
    expect(granolaSpeakerLabel({ source: "speaker" }, who)).toBe("Roger Tsai");
  });
  it("an iOS diarization label wins over the source", () => {
    expect(granolaSpeakerLabel({ source: "microphone", diarization_label: "Speaker A" }, who)).toBe(
      "Speaker A",
    );
  });
  it("falls back to plain words when no name is known", () => {
    expect(granolaSpeakerLabel({ source: "microphone" }, { recorder: null, other: null })).toBe(
      "Microphone",
    );
    expect(granolaSpeakerLabel({ source: "speaker" }, { recorder: null, other: null })).toBe(
      "Others on the call",
    );
  });
  it("an older plain-string speaker still works", () => {
    expect(granolaSpeakerLabel("Roger", who)).toBe("Roger");
    expect(granolaSpeakerLabel(undefined, who)).toBeNull();
  });
});

describe("GRANOLA-1 the stored transcript", () => {
  const who = granolaSpeakers(note);
  const raw = [
    { speaker: { source: "microphone" }, text: "Jared's the man." },
    { speaker: { source: "speaker" }, text: "Can you hear me okay?" },
  ];
  it("every line carries its label, and the old bug (no labels) is gone", () => {
    const text = renderGranolaTranscript(raw, who)!;
    expect(text).toContain("**Liam Sheridan:** Jared's the man.");
    expect(text).toContain("**Roger Tsai:** Can you hear me okay?");
  });
  it("opens with one line saying how labels were assigned, and that they are sources, not voices", () => {
    const text = renderGranolaTranscript(raw, who)!;
    expect(text.split("\n")[0]).toBe(
      "_Speakers: the microphone is labelled Liam Sheridan, who recorded the call; call audio is labelled Roger Tsai, the only other person on the invite. Granola records audio sources, not voices, so a label can be wrong if someone else spoke into the same source._",
    );
  });
  it("no note when nothing was labelled from a source; a string transcript passes through", () => {
    expect(granolaSpeakerNote(who, { mic: false, call: false })).toBeNull();
    expect(renderGranolaTranscript("as given", who)).toBe("as given");
    expect(renderGranolaTranscript([], who)).toBeNull();
  });
  it("no em dash in what is written into the record", () => {
    expect(renderGranolaTranscript(raw, who)).not.toMatch(/—/);
  });
});

describe("GRANOLA-1 re-import refreshes, keeps history", () => {
  const src = readFileSync("src/lib/connector-picker.functions.ts", "utf8");
  const fn = src.slice(
    src.indexOf("export const importGranolaMeetings"),
    src.indexOf("/** Gmail: label chips"),
  );
  it("a note already in Lasso is refreshed when its text changed, unchanged otherwise", () => {
    expect(fn).toContain(
      'existingByProviderId(supabase, profile.id, "connector:granola", "granola_id")',
    );
    expect(fn).toMatch(/if \(prior\.content_hash === hash\) \{\s*unchanged \+= 1;/);
    expect(fn).toContain('sourceEvent: "connector_reimport"');
    expect(fn).toContain(".update({ content_ref: newRef, content_hash: hash })");
  });
  it("new notes now store their fingerprint, and summaries refresh for new and refreshed notes", () => {
    expect(fn).toContain("content_hash: hash,");
    expect(fn).toContain("await ensureExtracts([...newIds, ...touchedIds]);");
    expect(fn).toContain(
      "return { imported, skipped, updated, unchanged, ids: [...newIds, ...touchedIds] };",
    );
  });
  it("the picker lets a Granola call already in Lasso be picked again, and says so", () => {
    const picker = readFileSync("src/components/connectors/ConnectorPicker.tsx", "utf8");
    expect(picker).toContain(
      'disabled={singlePick ? false : item.alreadyInLasso && kind !== "granola"}',
    );
    expect(picker).toContain('"In Lasso · pick to refresh"');
  });
  it("a 413 too-large transcript is fetched from its own endpoint", () => {
    const g = readFileSync("src/lib/granola.server.ts", "utf8");
    expect(g).toContain("error.status !== 413");
    expect(g).toContain("/transcript`");
  });
});
