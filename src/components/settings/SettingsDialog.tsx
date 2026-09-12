import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { useSettingsDialog } from "@/lib/settings-dialog-context";
import { SettingsShell, type SettingsSection } from "./SettingsShell";
import { ConnectorsSection } from "./ConnectorsSection";
import { DataUseCard } from "./DataUseCard";
import { PersonalDataCard } from "./YourDataCard";
import { NamingConventionsCard } from "./NamingConventionsCard";
import { OrgDimensionsCard } from "./OrgDimensionsCard";
import { YourWorkCard } from "./YourWorkCard";
import { AccountEmailCard } from "./AccountEmailCard";
import { InviteDialog } from "@/components/invites/InviteDialog";
import { EnterInviteCode } from "@/components/invites/EnterInviteCode";
import { Button } from "@/components/ui/button";

/**
 * SECTIONS mirrors SettingsPage.tsx — they are kept in sync manually.
 * If you add a section here, add it there too (for /settings fallback).
 */
const SECTIONS: SettingsSection[] = [
  {
    id: "connectors",
    label: "Connectors",
    hint: "where work comes from",
    group: "Settings",
    title: "Connectors",
    content: <ConnectorsSection />,
  },
  {
    id: "your-work",
    label: "Your work",
    hint: "how you describe it",
    group: "Settings",
    title: "Your work",
    content: <YourWorkCard />,
  },
  {
    id: "workspace",
    label: "Workspace",
    hint: "facts and naming",
    group: "Settings",
    title: "Workspace",
    content: (
      <div className="space-y-8">
        <OrgDimensionsCard />
        <NamingConventionsCard />
      </div>
    ),
  },
  {
    id: "account",
    label: "Account",
    hint: "who you are",
    group: "Account",
    title: "Account",
    content: <AccountEmailCard />,
  },
  {
    id: "people",
    label: "People",
    hint: "invites",
    group: "Account",
    title: "People",
    content: (
      <div className="space-y-6">
        <InviteDialog trigger={<Button type="button">Invite someone</Button>} />
        <EnterInviteCode label="Joining another workspace?" />
      </div>
    ),
  },
  {
    id: "data-use",
    label: "Data use",
    hint: "what it is used for",
    group: "Account",
    title: "Data use",
    content: <DataUseCard />,
  },
  {
    id: "your-data",
    label: "Your data",
    hint: "what leaves the workspace",
    group: "Account",
    title: "Your data",
    content: <PersonalDataCard />,
  },
];

/**
 * Floating settings dialog. Lazy mount + persist:
 * - Nothing in the DOM until the user first opens settings.
 * - Once opened, SettingsShell stays mounted even when the dialog is hidden,
 *   so DataUseCard's noteConsentPresented fires exactly once per session.
 */
export function SettingsDialog() {
  const { open, section, closeSettings } = useSettingsDialog();
  const [hasOpened, setHasOpened] = useState(false);

  // Record first open — never resets
  useEffect(() => {
    if (open) setHasOpened(true);
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeSettings();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeSettings]);

  // Nothing until first open
  if (!hasOpened) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      // display:none hides but does NOT unmount — keeps SettingsShell alive
      style={{ display: open ? undefined : "none" }}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={closeSettings}
        aria-hidden="true"
      />

      {/* Panel — centered */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
        <div className="pointer-events-auto relative h-[min(640px,calc(100vh-2rem))] w-full max-w-[1000px] overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-[0_8px_40px_rgba(42,40,32,0.18)]">
          {/* Close button */}
          <button
            type="button"
            onClick={closeSettings}
            className="absolute right-4 top-4 z-10 grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Shell fills the dialog — remove the page-level max-width wrapper */}
          <SettingsShell sections={SECTIONS} variant="dialog" initialSection={section} />
        </div>
      </div>
    </div>
  );
}
