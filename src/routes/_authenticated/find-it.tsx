import { createFileRoute } from "@tanstack/react-router";

import { FindItPage } from "@/pages/FindItPage";

export type FindItEntry = "peek" | "upload";

export const Route = createFileRoute("/_authenticated/find-it")({
  // Another surface can point at a piece of work and say where it came from.
  validateSearch: (
    search: Record<string, unknown>,
  ): { target?: string | undefined; entry?: FindItEntry | undefined } => {
    const target = typeof search["target"] === "string" ? (search["target"] as string) : undefined;
    const raw = search["entry"];
    const entry: FindItEntry | undefined =
      raw === "peek" || raw === "upload" ? (raw as FindItEntry) : undefined;
    return {
      ...(target ? { target } : {}),
      ...(entry ? { entry } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Find it | Lasso" },
      {
        name: "description",
        content:
          "Point at a finished piece of work and look back through your conversations for the ones that fed it.",
      },
      { property: "og:title", content: "Find it | Lasso" },
      {
        property: "og:description",
        content:
          "Point at a finished piece of work and look back through your conversations for the ones that fed it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FindItPage,
});
