// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LabContextCoronas } from "../LabContextCoronas";
import type { LabNode } from "../canvas-lab-model";

const picked: LabNode = { id: "picked", kind: "judgment", frame: null, title: "Picked", summary: "Picked", typeLabel: "judgment", ownership: "draft", x: 10, y: 20, width: 232, height: 112 };

describe("C3 WebGL fallback", () => {
  it("mounts without throwing and draws nothing when WebGL is unavailable", () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const result = render(<LabContextCoronas nodes={[picked]} entryDelays={{}} pan={{ x: 0, y: 0 }} zoom={1} viewport={{ width: 800, height: 600 }} interacting={false} still={false} heightOf={() => 180} />);
    const canvas = result.getByTestId("lab-context-coronas") as HTMLCanvasElement;
    expect(canvas.tagName).toBe("CANVAS");
    expect(getContext).toHaveBeenCalledWith("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    getContext.mockRestore();
  });
});
