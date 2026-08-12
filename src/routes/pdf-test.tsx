import { createFileRoute } from "@tanstack/react-router";
import { PdfView } from "@/components/peek/PdfView";

export const Route = createFileRoute("/pdf-test")({
  component: () => (
    <div className="p-6">
      <PdfView url="/__t.pdf" title="t" />
    </div>
  ),
});
