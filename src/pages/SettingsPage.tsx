import { NamingConventionsCard } from "@/components/settings/NamingConventionsCard";
import { AccountEmailCard } from "@/components/settings/AccountEmailCard";
import { InviteDialog } from "@/components/invites/InviteDialog";
import { EnterInviteCode } from "@/components/invites/EnterInviteCode";
import { Button } from "@/components/ui/button";

export function SettingsPage() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="page-title">Settings</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Workspace preferences that shape how Lasso reads your work.
        </p>
      </header>
      <div className="max-w-2xl">
        <div className="mb-4">
          <InviteDialog trigger={<Button type="button">Invite someone</Button>} />
        </div>
        <div className="mb-6">
          <EnterInviteCode label="Joining another workspace?" />
        </div>
        <div className="space-y-8">
          <AccountEmailCard />
          <NamingConventionsCard />
        </div>
      </div>
    </div>
  );
}
