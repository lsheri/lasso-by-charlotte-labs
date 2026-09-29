# Unit L4: privacy line

## Build
- Change only the company privacy copy in the existing register copy object.
- Render the selected privacy line directly below the submit action on account setup.
- Render the selected or neutral privacy line directly below the submit action on `/auth`.
- Add focused coverage for every register, neutral auth, and unchanged non-company strings.

## Data impact
- No user action, flow, consent surface, telemetry event, payload, or dimension changes.
- No database or schema work.

## Controls and states
- Preserve every existing control, loading state, success state, error state, redirect, and telemetry call on both screens.
- The only rendered-state addition is the quiet privacy sentence.

## Verification
- Run the focused L4 test and required guards.
- Run typecheck and one full suite against the stated baseline.
- Inspect both screens at 1280px and 390px when preview access permits.
