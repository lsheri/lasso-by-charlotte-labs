# Plan: one consistent Lasso circle mark

## Goal
Use one hand-drawn circle mark everywhere Lasso is presented as a brand:

- colour: the existing notebook green token (`--nb-green`), matching the sidebar screenshot
- proportion: the sign-in relationship, with the mark about 1.5 times the height of the “Lasso” word
- lockup: serif “Lasso” with the smaller handwritten “by Charlotte Labs” line

The founder has explicitly lifted the freeze for the logo only on `/` and `/landing-next`. All other content on those pages remains frozen. Email branding is included.

## What changes
1. **Make the shared brand lockup authoritative**
   - Extend the existing `BrandLockup` presentation component with compact and standard sizes.
   - Keep the same green circle drawing and the sign-in type relationship in both sizes.
   - Preserve accessible brand text and existing destination links.

2. **Replace brand-only variants across the web app**
   - Sign-in keeps its current standard-sized lockup.
   - The authenticated sidebar switches from its hand-built small version to the compact shared lockup.
   - Public and session headers switch from the dark mascot/mono treatment to the shared green-circle lockup.
   - Onboarding, invite, student entry, Why, and Trust switch from the navy mascot card to the shared lockup while preserving each placement’s current compact/large spacing contract.
   - The public-header logo changes on `/` and `/landing-next` only under the explicit logo-freeze exception. No page copy, layout, sections, video, telemetry, or other artwork changes.

3. **Keep non-brand circles separate**
   - Do not change the “What fed this?” glyph, evidence circles, coaching circles, provenance drawing, or the decorative animated circles within `/landing-next`.
   - Those marks communicate actions or content rather than product identity.

4. **Bring emails into the same system**
   - Create a static transparent green-circle image from the same circle path for email-client compatibility.
   - Store it as a durable project CDN asset and reference that one image from both auth emails and organization invites.
   - Change email wordmark styling from the current mono uppercase treatment to the same serif “Lasso” and handwritten “by Charlotte Labs” hierarchy, using email-safe fallbacks.
   - Email wording, links, actions, and delivery behaviour remain unchanged.

5. **Focused verification**
   - Add/update focused tests that pin the one green circle, shared wordmark text, intended size variants, frozen-page logo-only exception, and shared email asset.
   - Check sign-in, authenticated sidebar, a public header, and an email render visually.
   - Confirm the focused tests and clean app build.

## Existing controls and states to preserve
- **Sign-in:** logo link to home; sign-in/create/invited modes; all existing form, pending, error, and success states.
- **Authenticated sidebar:** navigation, profile card, organization switcher, collapsed/mobile behaviour, and all current badges.
- **Public header:** home logo link, current-page nav state, Why/Trust links, and account entry controls.
- **Session header:** asynchronously shown email and sign-out action, including its existing signed-in/loading behaviour.
- **Onboarding and join pages:** every existing step, back/continue/submit action, validation, loading, error, and completion state.
- **Why and Trust:** existing navigation and content states.
- **Emails:** the same confirmation, recovery, invite, email-change, magic-link, and reauthentication actions and URLs.

No controls or render states will be added, removed, or moved. Existing telemetry calls remain byte-for-byte unchanged: this is a presentation-only change.

## Data impact
- No user action, surface, or flow changes.
- No telemetry event, payload, or dimension changes.
- No consent surface or consent stamping changes.
- No database or schema changes.
- The only new stored item is a public, non-user email logo image.
