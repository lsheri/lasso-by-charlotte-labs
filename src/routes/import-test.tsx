import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { ImportFlowDialog } from "@/components/work/import/ImportFlowDialog";

export const Route = createFileRoute("/import-test")({ ssr: false, component: () => (
  <div className="p-10">
    <ImportFlowDialog trigger={<Button type="button">Import AI history</Button>} />
  </div>
) });
