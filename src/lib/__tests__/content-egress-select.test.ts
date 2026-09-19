import { describe, expect, it, vi } from "vitest";

import { selectContentPending } from "../content-egress.server";

describe("selectContentPending", () => {
  it("asks only for work the person mapped", async () => {
    const eq = vi.fn();
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    Object.assign(builder, {
      select: vi.fn(chain),
      eq: eq.mockImplementation(chain),
      is: vi.fn(chain),
      order: vi.fn(chain),
      limit: vi.fn(async () => ({ data: [], error: null })),
    });
    const admin = { from: vi.fn(() => builder) };

    await selectContentPending(admin as never);

    expect(admin.from).toHaveBeenCalledWith("work_items");
    expect(eq).toHaveBeenCalledWith("visibility", "mapped");
    const selected = (builder["select"] as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(selected).toContain("visibility");
  });
});
