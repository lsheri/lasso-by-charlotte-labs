import { useEffect, useState } from "react";
import { RICH_TEXT_CSS, sanitizeRichHtml } from "@/lib/rich-text";

export function RichTextView({ html }: { html: string }) {
  const [clean, setClean] = useState("");
  useEffect(() => { setClean(sanitizeRichHtml(html)); }, [html]);
  return <><style>{RICH_TEXT_CSS}</style><div className="rich-text" dangerouslySetInnerHTML={{ __html: clean }} /></>;
}