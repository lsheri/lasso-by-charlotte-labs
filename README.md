# Lasso Coaching Hub

Project name: Lasso by CL. This is a REAL production app build (not a mockup) for a coaching platform for consultancies: early-career engagement managers connect their work (documents, AI conversations, meeting transcripts), map it to engagements and tasks, and coaches review structured context instead of raw files. We will build it in careful phases. In THIS first message, build ONLY the application shell described below. Do NOT create any database tables, do NOT enable Supabase features, do NOT invent additional pages or mock data — the data layer will be provided separately by our architect.

DESIGN SYSTEM — "Bone + Slate", implement exactly as CSS custom properties and Tailwind config:
--bg:#F7F5F2; --fg:#2A2820; --card:#fff; --primary:#3A3830; --primary-fg:#D8D0B8; --secondary:#EEEAE4; --muted:#DDD8D0; --muted-fg:#908870; --accent:#607060; --accent-soft:#E7ECE7; --accent-deep:#3C4A3C; --border:#DDD8D0; --sidebar:#EEEAE4; --navy:#0B2A4A; --mint:#6FFAC6; --destructive:#9C3418; radius 12px; shadows subtle (0 1px 2px rgba(42,40,32,.04), 0 4px 16px rgba(42,40,32,.05)). Fonts: DM Sans (UI) and JetBrains Mono (labels/metadata) via @fontsource. Amber (#FBBF24 border, #FFFBEB bg, #78350F text) is RESERVED exclusively for "a recurring pattern" callouts — never use it decoratively. Aesthetic: calm, editorial, restrained — mono uppercase micro-labels with letter-spacing for section headers (e.g. "ENGAGEMENTS", "YOUR WORK"), generous whitespace, no gradients, no glassmorphism.

APP SHELL:
1. Left sidebar (264px, --sidebar background): top = user name-card (name, "Engagement Mgr" subtitle placeholder). Below it nav groups in THIS order with mono uppercase group labels: "CONNECTORS" (item: Where work lives), "WORK" (item: All work & mapping), "ENGAGEMENTS" (empty state for now), "YOUR WORK" (items: Overview, 1:1 prep, Decision log). Pinned to sidebar bottom: a navy (#0B2A4A) wordmark card reading "LASSO" in mono mint (#6FFAC6) letters, "by Charlotte Labs" beneath in small cream text, and a mint pill button "◆ Why Lasso".
2. Main content area (--bg) with placeholder pages for each nav item: just the page title in DM Sans 26px semibold with tight letter-spacing and a one-line muted subtitle. No fake data.
3. Routing: react-router with routes /connectors, /work, /overview, /one-on-one, /decisions. Default to /overview.
4. Auth: Supabase email/password auth pages (sign in / sign up) in the same design language — quiet card on bone background with the navy wordmark above. Protect all app routes behind auth. (Enabling the Supabase instance itself is fine for auth; creating tables is not.)
5. Mobile: sidebar collapses to a sheet; do not over-invest, desktop is primary.

Deliver exactly this scope. Keep components small and conventionally organized (src/components/layout, src/pages). No placeholder lorem beyond what is specified.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://lasso-by-charlotte-labs.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/57cd51ce-f7b4-4cd0-a7d0-761453b5935b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
