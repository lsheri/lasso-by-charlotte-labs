# TVe: Acts 1 and 2

## Data platform gate
- **Coverage:** Changes two local tour actions and the Act 1 to Act 3 teaching flow. Per dispatch, add no telemetry. Existing tour actions remain local and emit no events.
- **Consent:** No consent surfaces, consent stamping, or consent tables are touched.
- **Schema and portal:** No event names, payloads, or dimensions change.
- **Database:** No database work.

## Control rule
### Before
- Act 1: one Claude `Push to Lasso` control; pushing it advances to Act 2.
- Act 2: inert `Add a chat`, `Ask Lasso`, search, four tool filters, `Workboards`, and conversation count controls; the one arrived Claude card advances to Act 3.
- Shared stage: Skip; Back from Act 2; rail; instruction arrow and target glow.
- Act 1 states: timed turns, push line, push ready, pushed, reduced-motion complete.
- Act 2 states: static conversation list, one arrived card, ambient cards.
- Telemetry: none in these renderers.

### After
- Act 1: Claude and ChatGPT each have an independent `Push to Lasso`; neither advances. `Next` appears only after both are pushed and advances to Act 2.
- Act 2: the same inert conversation controls remain; a presentational sidebar adds inert navigation rows and one active `Fall Marketing Launch` workboard row that advances to Act 3 by pointer or keyboard. Arrived cards are inert.
- Shared stage controls and Acts 3–8 remain unchanged.
- Act 1 states: both transcripts advance concurrently from one shared elapsed step, each push target clears immediately after use, Next becomes the sole target, and reduced motion shows both complete.
- Act 2 states: two arrived cards followed by ambient cards; row-derived counts; sidebar target ready.
- Telemetry: none.

## Implementation
1. Extend tour content with a five-turn ChatGPT conversation titled `ChatGPT: launch week checklist`, using the same chat shape and delay constant as Claude. Update only Act 1 and Act 2 instruction and teaching copy.
2. Refactor the Act 1 local renderer into two responsive chat panes driven by one timer step. Track pushes separately and expose `Next` through the existing stage footer after both complete.
3. Add a route-local, presentational sidebar to Act 2 using `SidebarNav`’s visible structure and classes: grouped headings, icon rows, nested workboard row, and existing nav styling. Keep every non-workboard control inert.
4. Render both arrived chats first, derive every displayed count from the rows array, and make only the workboard row advance.
5. Update strict tests for concurrent timing, exact target lifecycle, Next gating, pointer and keyboard progression, sidebar title provenance, inert arrived cards, derived counts, and reduced motion. Preserve geometry assertions and Acts 3–8 tests.
6. Verify focused tests while editing, inspect 1280px and 390px previews, then make the final edit. After that, run the full Vitest suite exactly once and `bun run build`, reporting only failures outside the nine authorized baseline files.

## Technical note
The two tour conversations remain a static product demonstration built from the existing tour chat window and `WorkNote` presentation. They are not an agent transcript or composer, so introducing AI Elements would replace established tour-only primitives and exceed this two-act presentation change.
