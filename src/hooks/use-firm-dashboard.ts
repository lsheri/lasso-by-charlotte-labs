import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getFirmCheckLibrary,
  getFirmDashboard,
  setFirmCheckActive,
} from "@/lib/firm-dashboard.functions";
import type { FirmCheckLibraryRow, FirmDashboard } from "@/lib/firm-dashboard-shared";

export function useFirmDashboard(profileId: string | undefined) {
  return useQuery({
    queryKey: ["firm-dashboard", profileId],
    enabled: Boolean(profileId),
    staleTime: 60_000,
    queryFn: (): Promise<FirmDashboard> =>
      getFirmDashboard({ data: { profile_id: profileId as string } }),
  });
}

export function useFirmCheckLibrary(profileId: string | undefined) {
  return useQuery({
    queryKey: ["firm-check-library", profileId],
    enabled: Boolean(profileId),
    staleTime: 60_000,
    queryFn: (): Promise<FirmCheckLibraryRow[]> =>
      getFirmCheckLibrary({ data: { profile_id: profileId as string } }),
  });
}

export function useSetFirmCheckActive(profileId: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { check_id: string; active: boolean }) =>
      setFirmCheckActive({ data: { ...input, profile_id: profileId as string } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["firm-check-library"] });
      void client.invalidateQueries({ queryKey: ["firm-checks"] });
    },
  });
}
