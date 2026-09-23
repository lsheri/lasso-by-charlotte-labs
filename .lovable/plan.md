# P2: Render HTML and SVG artifacts on the board

## Data impact
- Add one render state to the existing card preview. No new action or surface.
- Reuse `workboard.card_content_viewed` and its existing `kind` dimension with the additive value `html`; add no event or dimension.
- No consent, database, schema, or write-path changes.

## Build
1. Extend `WorkboardFilePreview` with `kind: "html"` and optional full-document `html`.
2. Add an authenticated server read for artifact bytes. It will decide only from `source_meta.kind`, read `content_ref` from `work-files`, reject payloads above 1 MB, and return HTML or an SVG wrapped in a minimal HTML document. The existing text path remains the fallback for size and read failures.
3. Add and test `withPreviewCsp`, injecting exactly one CSP meta as the first child of an existing or created head, including bare fragments.
4. Render HTML previews in a sandboxed, no-referrer iframe. Pass the item title into the renderer.
5. Pass card focus into the preview and place a transparent interaction layer above the iframe only while unfocused, preserving board drag, selection, and wheel panning.
6. Reuse the HTML preview in the enlarged board view if its data path supports it. Leave unrelated Peek rendering unchanged if it uses a separate reader.
7. Route HTML scroll/open reporting through the existing `workboard.card_content_viewed` event with `kind: "html"`.

## Rule 8 preservation
### Before
- `WorkboardFilePreview` controls: previous page and next page.
- `WorkboardFilePreview` states: PDF loading/ready/failure, PDF page/count, slide page/count, text, fallback/null.
- `LabPreview` controls: Open larger.
- `LabPreview` states: chat preview, document/deck preview, absent preview; portrait or slide shape.
- Event reachability: page changes report existing document/deck viewing; Open larger reports the existing preview kind.

### After
- Every control and state above remains.
- Added state only: HTML/SVG iframe preview, with an unfocused interaction layer that is inactive when focused.
- Existing event path additionally receives `kind: "html"`; no event name or dimension changes.

## Verification
- Add `src/lib/__tests__/p2-html-preview.test.ts` for all three CSP document shapes, exact iframe restrictions, shared type acceptance, SVG wrapping, builder wiring, and focus overlay wiring.
- Run focused tests, `tsgo`, and the full suite; check the preview build log.
