// @vitest-environment jsdom
/** Canvas Lab polish 2c-iv: a save error remembers the change that failed. */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const call = vi.fn();
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => call }));
vi.mock("@/lib/canvas-lab.functions", () => ({ getCanvasLabBoardFn: async () => null, mutateCanvasLabBoardFn: () => undefined }));

const { useCanvasLab } = await import("@/hooks/use-canvas-lab");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("save error state", () => {
  it("carries the failed command and its entity, and replays exactly that command", async () => {
    call.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useCanvasLab("e1", undefined, "org"), { wrapper });
    const command = { type: "node_archive", nodeId: "n1", expectedVersion: 2 } as const;
    let outcome: { status: string } | undefined;
    await act(async () => { outcome = await result.current.persist(command); });
    expect(outcome?.status).toBe("network_error");
    await waitFor(() => expect(result.current.saveState.status).toBe("error"));
    const state = result.current.saveState;
    if (state.status !== "error") throw new Error("expected an error state");
    expect(state.entityKind).toBe("node");
    expect(state.retry).toEqual(command);

    call.mockResolvedValueOnce({ status: "saved", boardId: "b", boardVersion: 2, versions: {} });
    await act(async () => { await result.current.persist(state.retry); });
    expect(call).toHaveBeenLastCalledWith({ data: { engagement_id: "e1", command } });
  });
});
