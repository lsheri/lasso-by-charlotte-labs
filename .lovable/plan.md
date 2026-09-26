# Landing logo-rain loading intro

## Data impact
- Visual loading-state change only. No consent surfaces or consent logic change.
- No new user action is added, so no new event is needed.
- Existing event names, payloads, and dimensions remain unchanged. No portal-side update is required.

## Current behavior inventory
### Controls
- Header destination links and account actions.
- Hero actions: Watch it work, View a Workboard, Book a pilot.
- Product-video play/replay interactions.
- Story progress jumps.
- Proof links that open the slide or source conversation.
- Pilot form fields and submit action.
- Phone pilot action and footer links.

### Render states
- Public board request pending: desktop stage and phone view show loading copy.
- Public board open: desktop story and phone story render from the same public payload.
- Public board unavailable: the existing unavailable message renders.
- Existing story transition, settled, reduced-motion, video poster/failure, pilot sending/success/error, and phone stop states remain unchanged.

### Existing landing events
- `landing.viewed`: `{ variant: "b2b", surface: "landing-board", input_mode: "scroll" }`
- `landing.story_section_viewed`: `{ section, input_mode }`
- `landing.section_jumped`: `{ section }`
- `landing.proof_link_opened`: `{ step, target }`
- `landing.pilot_cta_clicked`: `{ placement }`
- `landing.pilot_requested`: `{ team_size }`
- `landing.see_it_work_clicked`: `{ location: "hero_workboard" }`
- `landing.usecase_played`: `{ card, input_mode }`

## Build
- Add a landing-only loading intro component in `LandingBoard.tsx`.
- Show the Lasso loop mark and regular-weight `LASSO` wordmark centrally.
- Fill about 30% of the viewport with a deterministic mix of the existing tool and AI marks: Claude, ChatGPT, Gemini, Copilot, Granola, Wispr, Drive, Gmail, Docs, Sheets, Slides, Calendar, OneDrive, SharePoint, Notion, Slack, and PowerPoint.
- Animate the marks falling from above with staggered timing for about 2.5 seconds, then fade into the ready landing content. Keep the unavailable state truthful if the request fails.
- For reduced motion, show the same branded composition without falling movement, then reveal content on the same timing.
- Add landing-scoped token-based styles in `src/styles.css`, with responsive logo sizing and distribution for phone and desktop.
- Update the existing landing safeguard test to pin the intro, timing, reduced-motion behavior, and unchanged events.
- Record the loading-intro architecture rule in `AGENTS.md`.

## Verification
- Compare the control, state, and event inventories after the change to confirm nothing was removed or renamed.
- Run the landing safeguards and inspect the preview build result.
- Capture the initial, mid-rain, and revealed states at 390×844 and 1440×900, checking density, overflow, readable branding, and that the page appears after the intro.
