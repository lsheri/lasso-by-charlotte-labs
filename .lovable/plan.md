# Past work screen port

## Scope
- Restyle `ArchivePage` to the supplied Past work structure while preserving its current data and access behavior.
- Add the presentational `ArchiveSpine` component to group existing shipped cards by engagement around a vertical spine.
- Keep `ArchivePile` inside each group so its seeded scatter, journey opening, owner-gated Take back menu, confirmation, mutation, and toast remain unchanged.
- Add the two requested closing `ToneCard` panels and handwritten closing line.

## Control preservation
- Keep both existing search experiences and all their current controls: Past work search input/submit/results links, archive question input, slash-key focus, send, skip, return, browse, result opening, and pile hiding.
- Keep every `ShippedWorkCard` control and test identifier unchanged through component reuse.
- Preserve coach redirect, null guard, independent coach checks, and the exact existing hook order.

## Data impact
- No data, consent, stamping, event name, payload, or dimension changes.
- Omit the optional engagement filter chips. They would add a new user action without an existing event, which conflicts with the project’s requirement that every new action be recorded and with this pass’s presentation-only constraints.

## Technical details
- Group the already sorted cards by `engagement_id` in `ArchivePage`; use a stable fallback key for cards without an engagement.
- Show engagement code/title, newest shipped date through the existing `formatDate`, and each group’s item count.
- Use existing semantic tokens only, with no dark-mode changes or bare letter-spacing utilities.

## Verification
- Confirm before/after control parity and all requested identifiers by source audit.
- Confirm hook order, guard placement, seeded `card.id` scatter, and banned-class absence.
- Run TypeScript checking and archive-focused tests.
- Check the latest preview build diagnostics. Do not deploy or perform database work.
