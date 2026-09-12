import { ConnectorsSection } from "@/components/settings/ConnectorsSection";
import { DataUseCard } from "@/components/settings/DataUseCard";
import { PersonalDataCard } from "@/components/settings/YourDataCard";
import { NamingConventionsCard } from "@/components/settings/NamingConventionsCard";
import { OrgDimensionsCard } from "@/components/settings/OrgDimensionsCard";
import { YourWorkCard } from "@/components/settings/YourWorkCard";
import { AccountEmailCard } from "@/components/settings/AccountEmailCard";
import { SettingsShell, type SettingsSection } from "@/components/settings/SettingsShell";
import { InviteDialog } from "@/components/invites/InviteDialog";
import { EnterInviteCode } from "@/components/invites/EnterInviteCode";
import { Button } from "@/components/ui/button";

/**
 * SECTIONS mirrors SettingsDialog.tsx — they are kept in sync manually.
 * If you add a section here, add it there too.
 *
 * Cards that render null for the current role (PersonalDataCard for a coach,
 * OrgDimensionsCard and NamingConventionsCard for a member) leave their section
 * visibly empty. That is a known rough edge, not a bug to route around here.
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

export function SettingsPage() {
  return <SettingsShell sections={SECTIONS} defaultSection="account" />;
}
