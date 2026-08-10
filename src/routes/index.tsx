import { createFileRoute, redirect } from "@tanstack/react-router";

import { fetchProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const profile = await fetchProfile().catch(() => null);
    if (profile?.role === "coach") throw redirect({ to: "/coaching" });
    throw redirect({ to: "/overview" });
  },
});
