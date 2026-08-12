import { createFileRoute } from "@tanstack/react-router";
import { PdfView } from "@/components/peek/PdfView";

export const Route = createFileRoute("/pdf-test")({
  component: () => (
    <div className="p-6">
      <PdfView url="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" title="t" />
    </div>
  ),
});
