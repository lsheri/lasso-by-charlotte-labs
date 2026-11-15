import { ConnectYourAiCard } from "@/components/connectors/ConnectYourAiCard";
import { useBrandCopy } from "@/components/skin/use-skin";

export function McpSection() {
  const copy = useBrandCopy();
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted-foreground">
        {copy(
          "Add Lasso to Claude or ChatGPT once. After that, any conversation can be pushed here by asking.",
        )}
      </p>
      <ConnectYourAiCard />
    </div>
  );
}
