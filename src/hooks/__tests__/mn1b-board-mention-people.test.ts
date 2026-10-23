import { describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { readBoardMentionPeople } from "@/hooks/use-board-mention-people";

describe("MENTION-1b board candidates", () => {
  it("uses board_people and never includes the viewer, even if returned", async () => {
    rpc.mockResolvedValue({ data: [{ profile_id: "me", display_name: "Liam" }, { profile_id: "guest", display_name: "Ben Stanton" }], error: null });
    expect(await readBoardMentionPeople("e", "me")).toEqual([{ profileId: "guest", displayName: "Ben Stanton" }]);
    expect(rpc).toHaveBeenCalledWith("board_people", { p_engagement: "e" });
  });
  it("an unauthorised empty response stays empty", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await readBoardMentionPeople("e", "me")).toEqual([]);
  });
});