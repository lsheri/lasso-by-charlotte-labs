import { createFileRoute, redirect } from "@tanstack/react-router";

import { cleanActivationKey, markActivationKey } from "@/lib/key-entry";

// Unit J1: a partner link. No UI; store the code and hand off to /auth.
export const Route = createFileRoute("/j/$code")({
  ssr: false,
  beforeLoad: ({ params, location }) => {
    const code = cleanActivationKey(params.code);
    if (code) markActivationKey(code);
    const from = new URLSearchParams(location.searchStr ?? "").get("from");
    throw redirect({
      to: "/auth",
      search: {
        ...(code ? { key: code } : {}),
        ...(from ? { from } : {}),
      } as never,
    });
  },
});
