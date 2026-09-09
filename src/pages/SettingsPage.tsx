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
 * The six sections are the ones that actually exist in code. The design file
 * also lists a Notifications section, which has no implementation, so it is not
 * shown here rather than shown empty.
 *
 * Cards that render null for the current role (PersonalDataCard for a coach,
 * OrgDimensionsCard and NamingConventionsCard for a member) leave their section
 * visibly empty. That is a known rough edge, not a bug to route around here.
 */
const SECTIONS: SettingsSection[] = [
  {
    id: "account",
    label: "Account",
    hint: "who you are",
    content: <AccountEmailCard />,
  },
  {
    id: "your-work",
    label: "Your work",
    hint: "how you describe it",
    content: <YourWorkCard />,
  },
  {
    id: "workspace",
    label: "Workspace",
    hint: "facts and naming",
    content: (
      <div className="space-y-8">
        <OrgDimensionsCard />
        <NamingConventionsCard />
      </div>
    ),
  },
  {
    id: "data-use",
    label: "Data use",
    hint: "what it is used for",
    content: <DataUseCard />,
  },
  {
    id: "your-data",
    label: "Your data",
    hint: "what leaves the workspace",
    content: <PersonalDataCard />,
  },
  {
    id: "people",
    label: "People",
    hint: "invites",
    content: (
      <div className="space-y-6">
        <InviteDialog trigger={<Button type="button">Invite someone</Button>} />
        <EnterInviteCode label="Joining another workspace?" />
      </div>
    ),
  },
];

export function SettingsPage() {
  return <SettingsShell sections={SECTIONS} />;
}
