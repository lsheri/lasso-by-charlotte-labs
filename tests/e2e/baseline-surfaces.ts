/**
 * The design baseline's surfaces and viewports as plain data.
 *
 * design-baseline.spec.ts walks these with Playwright; the Storybook screens
 * page lays out their pictures. Neither keeps its own list. Adding a surface is
 * one entry here plus its opener in the spec. No imports, so any tool can read it.
 */

export const VIEWPORTS = [
  { id: "desktop-1280", width: 1280, height: 900 },
  { id: "phone-375", width: 375, height: 812 },
] as const;

export type ViewportId = (typeof VIEWPORTS)[number]["id"];

export const BASELINE_SURFACES = [
  { id: "01-landing", label: "Landing", auth: false },
  { id: "02-sign-in", label: "Sign in", auth: false },
  { id: "03-plans", label: "Plans", auth: false },
  { id: "04-onboarding-tour", label: "Onboarding tour", auth: false },
  { id: "05-home", label: "Home", auth: true },
  { id: "06-all-work", label: "All work", auth: true },
  { id: "07-sidebar-open", label: "Sidebar open", auth: true, only: "desktop-1280" },
  { id: "08-board-and-toolbar", label: "Board and toolbar", auth: true },
  { id: "09-ask-idle", label: "Ask, idle", auth: true },
  { id: "10-ask-thinking", label: "Ask, thinking", auth: true },
  { id: "11-share-dialog", label: "Share dialog", auth: true },
  { id: "12-settings", label: "Settings", auth: true },
  { id: "13-sources", label: "Sources", auth: true },
  { id: "14-mobile-tab-bar", label: "Mobile tab bar", auth: true, only: "phone-375" },
] as const satisfies readonly BaselineSurface[];

export type BaselineSurface = {
  id: string;
  label: string;
  /** Needs a signed-in session. */
  auth: boolean;
  /** Exists on this viewport only. */
  only?: ViewportId;
};

export type SurfaceId = (typeof BASELINE_SURFACES)[number]["id"];
