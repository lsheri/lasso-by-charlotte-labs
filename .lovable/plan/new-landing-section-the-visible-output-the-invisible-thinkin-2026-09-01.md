# New landing section: the visible output, the invisible thinking

A new story beat sits directly under "The Problem" section and directly above the "With Lasso" section. It shows the two halves of AI shaped work side by side: a stream of app logos feeding the work on the left, and the clean finished deliverable on the right, with everything in between (judgment, decisions, drafts, process) rendered as a blurred, unreadable band.

## What the visitor sees

A wider, two column beat that breaks out of the narrow text column:

```text
   ┌──────────────────────────┬──────────────────────────┐
   │  FEED (left)             │  OUTPUT (right)          │
   │                          │                          │
   │   [ChatGPT]  [Claude]    │   ┌────────────────┐     │
   │   [Gemini]  [Lovable]    │   │  clean, sharp  │     │
   │   [Drive]   [Slack]      │   │  deliverable   │     │
   │   logos drifting right   │   │  (your clip)   │     │
   │        ↓                 │   └────────────────┘     │
   │  ░░ blurred band ░░      │                          │
   │  judgment · decisions ·  │   "The output is the     │
   │  drafts · process        │    only part that        │
   │  (unreadable, faded)     │    survives."            │
   └──────────────────────────┴──────────────────────────┘
```

- Left: six to eight product marks drift slowly rightward and fade as they pass into a heavily blurred band. Ghost words behind the blur (judgment, decisions, drafts, the questions asked, what was rejected) stay deliberately unreadable, so the blur reads as loss, not decoration.
- Right: the uploaded screen recording plays muted and looping, in view only, sharp and clean, framed like the other clips.
- Copy underneath the pair, plain and short: the output is polished and shareable, the thinking that produced it is gone.
- Section label above: THE GAP. No handwritten mark on this one so "The Problem" and "With Lasso" stay the only two annotations, and this section reads as part of the problem beat.

Motion respects prefers-reduced-motion: the logos hold still, the blurred band stays, the clip shows its poster with a Play control, matching how every other clip behaves.

## Layout adjustments

The story currently alternates left and right offsets down the page. To fit a wider two column beat without breaking that rhythm:

- The new section is centered and allowed to run wider than the text column on desktop, so the drift and the clip both have room.
- "The Problem" section keeps its right offset; the "With Lasso" section keeps its left offset and follows immediately after the new one.
- On mobile the two columns stack: feed animation first, then the clip.

## Technical notes

- New component `src/components/marketing/InvisibleWorkStrip.tsx`: CSS keyframe drift plus a blurred overlay band, no new dependencies, no data fetching. Product marks reuse the existing `VendorMark` set and add neutral glyphs for the non LLM sources.
- The uploaded recording is encoded to `public/videos/lasso-clean-output.mp4` with a poster frame `public/videos/poster-clean-output.jpg`, matching the existing clip convention, and played through the existing `ClipPlayer` with its own group id so it does not fight the collage clips for playback.
- `src/routes/index.tsx`: insert the new `FocusSection` between the existing problem section and the record section.
- Tests: extend `src/lib/__tests__/pass138-landing.test.tsx` to assert the new section label, headline, and that the clip and strip render.

## Data impact

Presentation only on a public page: no new user actions, no clicks to cover, no new or changed events, no consent surfaces touched, no schema work. Session replay stays disabled on this route as today.
