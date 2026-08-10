import { createFileRoute } from "@tanstack/react-router";

import { ImportHistoryDialog } from "@/components/work/ImportHistoryDialog";
import { SuggestionChip } from "@/components/work/SuggestionChip";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tmp-verify")({
  component: () => (
    <div className="space-y-4 p-8">
      <ImportHistoryDialog trigger={<Button type="button">Import AI history</Button>} />
      <SuggestionChip
        label="EMP-COAL · Kickoff deck"
        reason="title contains EMP-COAL"
        pending={false}
        onAccept={() => {}}
        onDismiss={() => {}}
      />
    </div>
  ),
});
