import { ConnectYourAiCard } from "@/components/connectors/ConnectYourAiCard";

export function McpSection() {
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted-foreground">
        Add Lasso to Claude or ChatGPT once. After that, any conversation can be pushed here by
        asking.
      </p>
      <ConnectYourAiCard />
    </div>
  );
}
