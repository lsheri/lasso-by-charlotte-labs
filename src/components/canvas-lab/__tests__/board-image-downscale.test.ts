// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const { upload } = vi.hoisted(() => ({ upload: vi.fn(async () => ({ error: null })) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "person" } } }) },
  storage: { from: () => ({ upload }) },
} }));
vi.mock("@/lib/workboard-file-sign", () => ({ signWorkboardFileUrl: vi.fn() }));
import { fitWithin, readImageSize, uploadBoardImage } from "../board-image";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); upload.mockClear(); });

describe("PASTE-2 image sizing", () => {
  it("fits landscape to 2048 by 1536", () => expect(fitWithin(4000, 3000)).toEqual({ width: 2048, height: 1536 }));
  it("keeps a smaller image unchanged", () => expect(fitWithin(1200, 800)).toEqual({ width: 1200, height: 800 }));
  it("rounds portrait to 410 by 2048", () => expect(fitWithin(1000, 5000)).toEqual({ width: 410, height: 2048 }));

  it.each(["image/png", "image/webp"])("sizes the actual uploaded %s blob and keeps the name", async (type) => {
    let decoded = 0;
    vi.stubGlobal("Image", class {
      naturalWidth = ++decoded === 1 ? 4000 : 2048;
      naturalHeight = decoded === 1 ? 3000 : 1536;
      onload: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    });
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });
    const draw = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: draw } as unknown as CanvasRenderingContext2D);
    const encode = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, mime) => callback(new Blob(["scaled"], { type: mime ?? "image/png" })));
    const file = new File(["original"], "original-name.webp", { type });
    expect(await readImageSize(file)).toEqual({ width: 2048, height: 1536 });
    await uploadBoardImage(file);
    const uploaded = upload.mock.calls[0] as unknown as [string, File];
    expect(uploaded[1]).not.toBe(file);
    expect(uploaded[1].name).toBe(file.name);
    expect(uploaded[1].type).toBe(type === "image/png" ? "image/png" : "image/jpeg");
    expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 2048, 1536);
    expect(encode).toHaveBeenCalledWith(expect.any(Function), uploaded[1].type, 0.9);
    expect(decoded).toBe(2);
  });

  it("uploads an undecodable file unchanged", async () => {
    vi.stubGlobal("URL", { createObjectURL: () => "blob:bad", revokeObjectURL: vi.fn() });
    vi.stubGlobal("Image", class {
      onerror: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onerror?.()); }
    });
    const file = new File(["bad"], "bad.png", { type: "image/png" });
    await uploadBoardImage(file);
    expect(upload).toHaveBeenCalledWith(expect.any(String), file);
  });
});