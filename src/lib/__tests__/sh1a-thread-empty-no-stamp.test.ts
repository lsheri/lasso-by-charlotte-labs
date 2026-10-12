import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMock = vi.fn();
const eqMock = vi.fn();
const uploadMock = vi.fn();
const logHealthMock = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "work_items") throw new Error(`unexpected table ${table}`);
      return { update: updateMock };
    },
    storage: {
      from: () => ({ upload: uploadMock }),
    },
  },
}));

vi.mock("@/lib/health.server", () => ({
  logHealth: logHealthMock,
}));

import { getItemText } from "@/lib/item-text.server";

function turnsClient(rows: Array<{ turn_no: number; role: string; content: string }>) {
  return {
    from: (table: string) => {
      if (table !== "turns") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: rows, error: null }),
          }),
        }),
      };
    },
  } as never;
}

const THREAD_ITEM = {
  id: "wi-thread-1",
  title: "A conversation",
  type: "ai_thread",
  content_ref: null,
  source_meta: null,
  meta: null,
} as never;

describe("getItemText thread branch (SH-1a)", () => {
  beforeEach(() => {
    updateMock.mockReset();
    eqMock.mockReset();
    uploadMock.mockReset();
    logHealthMock.mockReset();
    updateMock.mockReturnValue({ eq: eqMock });
    eqMock.mockResolvedValue({ error: null });
    uploadMock.mockResolvedValue({ error: null });
    logHealthMock.mockResolvedValue(undefined);
  });

  it("an empty thread returns unreadable without stamping the owner's row", async () => {
    const result = await getItemText(turnsClient([]), THREAD_ITEM);
    expect(result.status).toBe("unreadable");
    expect(result.reason).toBe("empty_thread");
    expect(result.text).toBeNull();
    expect(updateMock).not.toHaveBeenCalled();
    expect(logHealthMock).not.toHaveBeenCalled();
  });

  it("a thread with turns is ok and does stamp the row", async () => {
    const result = await getItemText(
      turnsClient([
        { turn_no: 1, role: "user", content: "What changed?" },
        { turn_no: 2, role: "assistant", content: "Phase one shipped." },
      ]),
      THREAD_ITEM,
    );
    expect(result.status).toBe("ok");
    expect(result.text).toContain("What changed?");
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(logHealthMock).not.toHaveBeenCalled();
  });
});
