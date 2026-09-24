# Landing page story and motion redesign

## Outcome
Turn the first screen and “How it works” sequence into one clear story for consulting-firm buyers:

```text
Claude, ChatGPT, Gemini
          ↓
real work conversations and human choices
          ↓
a polished four-slide client deck
          ↓
plain-language questions answered with the exact source
```

The visual will feel like a living case study rather than a product screenshot.

## Data impact and safeguards
- This is a public-page redesign. It changes presentation, scroll behavior, and the visible example content.
- It does not touch consent, authenticated user data, the database, routes, or the pilot-request flow.
- Keep the existing events and payloads unchanged: `landing.viewed`, `landing.pilot_cta_clicked`, `landing.see_it_work_clicked`, and `landing.pilot_requested`.
- Add one additive event for the new carousel interaction, emitted once per section per visit: `landing.story_section_viewed` with the section key and input mode. This requires the matching data-portal event update before release.
- No SQL or schema work.
- All new copy will follow the project language rules and contain no em dashes.

## First screen
- Use the founder-approved title exactly: **“Your firm bought AI. The human judgment, process, and thinking in your team's work went invisible.”**
- Animate a hand-drawn lime highlighter behind **“The human judgment, process, and thinking”** after a 3-second delay, hold for 10 seconds, fade away, then repeat.
- Keep the title readable throughout. Under reduced motion, show the completed highlight without movement.
- Tighten the supporting copy around Lasso’s actual position: the reasoning and judgment layer for AI-assisted consulting.
- Preserve **Book a pilot**, **See it work**, and **Start your own record**, including their current destinations and event payloads.

## “How it works” visual
- Replace the current board-like composition with a cinematic left-to-right evidence flow.
- Show cards for Claude, ChatGPT, and Gemini with their real existing logos and recognizable, distinct treatments.
- Animate short work fragments and decisions flowing from those conversations into a four-slide client deck.
- Build four visually complete sample slides with a mix of editorial imagery, charts, and clearly illustrative figures. The example will be internally consistent and will not imply customer results.
- Keep the slides to four:
  1. Audience signal, with an image and a concise audience chart.
  2. Channel evidence, with a comparison chart and source fragments.
  3. Commercial case, with illustrative unit economics and the key 18% example.
  4. Recommendation, showing the chosen direction and the rejected alternative.
- Render incoming Ask Lasso questions as ordinary work questions, not app chrome. Include: **“Find the link to the Claude conversation where I said ‘xyz’.”**
- Show the relevant conversation, deck claim, and answer becoming connected in sequence.
- Use generated editorial imagery only inside the illustrative deck. The uploaded screenshot remains a visual reference and will not be embedded.

## Value proposition carousel
- Replace the five implementation-led beats with four buyer-centered sections that match the visual story:
  1. **Keep the thinking, not just the output.** Bring work from the AI tools the team already uses into one durable record.
  2. **Move from a claim to its source in one click.** Connect a deck statement to the conversation and human choice behind it.
  3. **Know what shaped the answer.** Show what was read, what was left out, and why, without overstating what the product does.
  4. **Share the work without surrendering the whole record.** Preserve the existing read-only, time-limited, user-chosen sharing promise.
- Present these as a sticky, scroll-driven carousel on larger screens: the story advances one section at a time while the visual updates beside it.
- On phones, use a natural vertical sequence with the visual paired to each section. Avoid scroll trapping and horizontal overflow.
- Keep the pilot section, form, footer, and individual-user route intact.

## Control and state continuity

### Before
- Controls: Book a pilot, See it work, Start your own record, header navigation, four slide selectors in the motion visual, second Book a pilot action, pilot form fields and submit, footer links.
- States: initial hero, five in-view animated beats, paused off-screen beats, reduced motion, pilot form idle/submitting/success/error, desktop and mobile layouts.

### After
- The same navigation, CTA, pilot-form, submit, success, error, desktop, mobile, and reduced-motion states remain.
- The four slide selectors remain available and keyboard accessible, with clearer progress styling.
- The five beat states become four scroll-led story sections. Keyboard and touch users can still move through them without relying on wheel input.
- No control or form handler is removed. The only new interaction is section advancement, covered by the additive event above.

## Technical approach
- Restyle and restructure the existing marketing-only components. Do not change shared app tokens or authenticated screens.
- Reuse the existing `VendorMark` logo source rather than redrawing or hotlinking brands.
- Keep the current scaled-stage technique, but simplify the timing into a shorter, legible sequence synchronized with the active story section.
- Use semantic landing-page tokens and local marketing styles. Do not alter global behavior outside `/`.
- Preserve the existing animation pause-on-hidden behavior and add complete reduced-motion states.

## Verification
- Update landing tests for the exact title, four-slide limit, logo use, work-question copy, carousel accessibility, reduced motion, and additive event contract.
- Run the focused landing suites, the full relevant test set, type safety, formatting checks, and preview build validation.
- Verify the signed-out public page at desktop and phone widths, including the 3-second highlight delay, 10-second hold, carousel progression, keyboard controls, form states, no overflow, and no blank screen.
- Recheck every visible claim against implemented behavior before completion.
