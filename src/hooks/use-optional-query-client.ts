import { useQueryClient, type QueryClient } from "@tanstack/react-query";

/** The query client when one is provided, otherwise null (isolated previews and tests). */
export function useOptionalQueryClient(): QueryClient | null {
  try {
    return useQueryClient();
  } catch {
    return null;
  }
}
