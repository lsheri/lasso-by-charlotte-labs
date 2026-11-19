/**
 * The Kestrel Bay demo story: recorded answers for the beats that depend on a live model answer.
 *
 * Each one is a real answer the product gave to a demo person on the live site, copied word for word, with the date
 * and the build it came from. Nothing here was written by hand. It is server-only data: it reaches a browser only
 * through firmStoryRecordingCall, for an allowed person of the demo firm, in the window that plays the beat.
 *
 * No recording may carry a fee or any amount of money: fees reach only admins and leads and are drawn by code from
 * data, never from text. That is why the fees beat has no recording.
 *
 * To add or replace one: run the beat on the live site as a demo person, copy the answer exactly, set the date and
 * the build, and bump the script version if the beat's question changed.
 */

import type { StoryWindow } from "./firm-story-script";

export type StoryRecordingSource = { board: string; document: string; kind: string; dated: string };

export type StoryRecording = {
  beat: number;
  window: StoryWindow;
  /** The question exactly as it was asked. */
  question: string;
  /** The day it was recorded, as shown on the card. */
  recordedOn: string;
  /** The live build that gave the answer. */
  build: string;
  /** How long the live answer took, in seconds, so a presenter knows what "slow" means. */
  seconds: number;
  /** True when only the opening of the answer was kept. */
  partial: boolean;
  paragraphs: readonly string[];
  sources: readonly StoryRecordingSource[];
};

export const FIRM_STORY_RECORDINGS: readonly StoryRecording[] = [
  {
    beat: 1,
    window: "partner",
    question: "Have we designed a new service line for a health system before?",
    recordedOn: "19 Nov 2026",
    build: "270ca0b2",
    seconds: 20,
    partial: true,
    paragraphs: [
      "Yes, we have designed service lines for two health systems: an integrated behavioral health line for Cedarmere Regional Health and a comprehensive weight management line for St. Brigid Health. The Cedarmere engagement overran and was extended because payer work started late.",
      "For Cedarmere Regional Health, we recommended an integrated behavioral health service line inside primary care, with 13 care managers across 26 clinics backed by three consulting psychiatrists.",
    ],
    sources: [
      {
        board: "Integrated behavioral health service line",
        document: "Final readout: integrated behavioral health service line",
        kind: "Deck",
        dated: "6 Aug 2024",
      },
    ],
  },
];

export function recordingFor(beat: number, window: StoryWindow): StoryRecording | null {
  return FIRM_STORY_RECORDINGS.find((recording) => recording.beat === beat && recording.window === window) ?? null;
}
