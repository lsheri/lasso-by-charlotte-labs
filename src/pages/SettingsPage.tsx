import { NamingConventionsCard } from "@/components/settings/NamingConventionsCard";

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
        <NamingConventionsCard />
      </div>
    </div>
  );
}
