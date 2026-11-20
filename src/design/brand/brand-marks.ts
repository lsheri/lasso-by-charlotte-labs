/**
 * Every place that draws a brand mark, in one list, so a logo change is one known set of files (Liam, 15 Nov 2026:
 * "if we change logo again later we need all these logo placements tagged so switches is easy").
 *
 * Rules, enforced by src/design/__tests__/brand-marks.test.ts:
 * - Only these files draw a mark (inline SVG, canvas or image). Everything else renders one of the switches below,
 *   which pick the mark from the skin.
 * - Each file tags the element it draws with data-brand-mark="lasso" | "charlotte" | "slate-spool". The brand guard
 *   (tests/e2e/brand-guard.spec.ts) fails on any data-brand-mark="lasso" under Charlotte.
 * - The Lasso-only components are imported only by a switch.
 *
 * - Every screen that shows the brand is listed under PLACEMENTS by kind, so a new placement is a decision, not an
 *   accident. A brand name set as plain text where the brand belongs (a menu title, say) is the mistake this catches:
 *   use the lockup.
 *
 * To change a logo: edit the drawings listed under DRAWINGS, and check each SWITCHES entry still picks the right one.
 * To change how one kind of placement looks (the lockup's spacing, say), edit its switch; every placement follows.
 */

/** Files that draw a mark, and what each draws. */
export const DRAWINGS = {
  "src/components/layout/LassoLoopMark.tsx": "Lasso: the still loop",
  "src/components/reflect/LassoThinkingMark.tsx": "Lasso: the moving loop (canvas); also the switch to Charlotte's",
  "src/components/canvas-lab/ask-draft/AskLiveMark.tsx": "Lasso: the Ask box loop with its light; also the switch to Charlotte's",
  "src/design/brand/CharlotteMark.tsx": "Charlotte: the Monoline C and its reading web",
  "src/design/brand/CharlotteTile.tsx": "Charlotte: the lapel tile (icons, stories)",
  "src/design/brand/SpoolScriptMark.tsx": "Slate / Spool script: the spool and the thread that writes the l",
} as const;

/** Components that choose the mark from the skin. Screens render these, never a drawing directly. */
export const SWITCHES = {
  BrandMark: "src/components/layout/BrandLockup.tsx",
  BrandLockup: "src/components/layout/BrandLockup.tsx",
  LassoThinkingMark: "src/components/reflect/LassoThinkingMark.tsx",
  AskLiveMark: "src/components/canvas-lab/ask-draft/AskLiveMark.tsx",
} as const;

/** Lasso-only drawings, and the only files allowed to import each. */
export const LASSO_ONLY = {
  LassoLoopMark: ["src/components/layout/BrandLockup.tsx"],
} as const;

/**
 * Where each kind of placement appears. Kinds:
 * - lockup: the mark beside the wordmark (headers, sign-in, menus). Rendered with BrandLockup.
 * - mark: the still mark alone (toolbar Ask button, answer links, landing). Rendered with BrandMark.
 * - wordmark: the name as text inside a lockup a surface sets itself (landing, demo). Rendered with BrandWordmark.
 * - thinking: the mark that moves while the AI reads (Ask, Home, tour). Rendered with LassoThinkingMark.
 * - ask: the Ask box's own mark. Rendered with AskLiveMark.
 */
export const PLACEMENTS = {
  lockup: {
    component: "BrandLockup",
    files: [
      "src/components/layout/AppShell.tsx",
      "src/components/layout/AppShellSkeleton.tsx",
      "src/components/layout/AppSidebar.tsx",
      "src/components/layout/PublicHeader.tsx",
      "src/components/layout/SessionHeader.tsx",
      "src/pages/CanvasLabPage.tsx",
      "src/routes/auth.tsx",
      "src/routes/oauth/consent.tsx",
      "src/routes/plans.tsx",
      "src/routes/reset-password.tsx",
    ],
  },
  mark: {
    component: "BrandMark",
    files: [
      "src/components/canvas-lab/WorkboardChrome.tsx",
      "src/components/demo/DemoWorkboardSandbox.tsx",
      "src/components/find-it/FindItLink.tsx",
      "src/components/layout/BrandLockup.tsx",
      "src/components/marketing/LandingBoard.tsx",
      "src/components/pill/ChatPill.tsx",
      "src/components/proposals/MessageDevices.tsx",
      "src/components/reflect/AnswerTurnLinks.tsx",
      "src/components/reflect/AskSurface.tsx",
      "src/components/tour/TourActs.tsx",
      "src/pages/CanvasLabPage.tsx",
    ],
  },
  wordmark: {
    component: "BrandWordmark",
    files: ["src/components/demo/DemoWorkboardSandbox.tsx", "src/components/marketing/LandingBoard.tsx"],
  },
  thinking: {
    component: "LassoThinkingMark",
    files: [
      "src/components/demo/DemoWorkboardSandbox.tsx",
      "src/components/find-it/FindItResults.tsx",
      "src/components/home/HomeBoard.tsx",
      "src/components/reflect/AskSurface.tsx",
      "src/components/reflect/AskThinkingFoot.tsx",
      "src/components/reflect/ContextTrail.tsx",
      "src/components/provenance/ProvenanceAudit.tsx",
      "src/components/tour/TourActs.tsx",
      "src/pages/CanvasLabPage.tsx",
    ],
  },
  ask: {
    component: "AskLiveMark",
    files: ["src/components/canvas-lab/ask-draft/AskDraftSurface.tsx"],
  },
} as const;
