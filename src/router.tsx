import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { registerProfileQueryClient } from "@/hooks/use-profile";

import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();
  // PERF-2a: registered before the first beforeLoad runs, so the signed-in
  // gate reads identity and profiles through this cache.
  if (typeof window !== "undefined") registerProfileQueryClient(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
