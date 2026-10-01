// @vitest-environment jsdom
import { cleanup, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn(async () => ({ error: null }));
const logEvent = vi.fn();
const toastFn = vi.fn();
let seq = 0;

vi.mock("sonner", () => ({ toast: Object.assign((m: string) => toastFn(m), { error: (m: string) => toastFn(m) }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn(async () => {}) }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn(async () => ({})) }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { id: "p1", org_id: "o1" } }) }));
vi.mock("@/lib/extract.functions", () => ({ ensureExtractsFn: {} }));
vi.mock("@/lib/work-taxonomy.functions", () => ({ noteCaptureFn: {} }));
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => logEvent(...a) }));
vi.mock("@/lib/telemetry-v2", () => ({ logV2: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    storage: { from: () => ({ upload }) },
    from: () => ({ insert: () => ({ select: () => ({ maybeSingle: async () => ({ data: { id: `w${++seq}` }, error: null }) }) }) }),
  },
}));

import { BoardFileDropOverlay, useBoardFileDrop } from "@/components/canvas-lab/board-file-drop";

const place = vi.fn();
function Harness() {
  const drop = useBoardFileDrop({ enabled: true, toBoard: (x, y) => ({ x: x * 2, y: y * 2 }), place });
  return <div data-testid="shell" {...drop.handlers}><BoardFileDropOverlay show={drop.over} /></div>;
}
const files = (n: number) => Array.from({ length: n }, (_, i) => new File(["x"], `f${i}.pdf`, { type: "application/pdf" }));
function dropAt(el: HTMLElement, x: number, y: number, list: File[]) {
  const event = createEvent.drop(el, { dataTransfer: { types: ["Files"], files: list } });
  Object.defineProperty(event, "clientX", { value: x });
  Object.defineProperty(event, "clientY", { value: y });
  fireEvent(el, event);
}
const PROMPT = "Drop to add to this board";

describe("DD1-a board file drop", () => {
  afterEach(cleanup);
  beforeEach(() => { upload.mockClear(); logEvent.mockClear(); place.mockClear(); toastFn.mockClear(); });

  it("1. a file dragover shows the prompt", () => {
    render(<Harness />);
    fireEvent.dragOver(screen.getByTestId("shell"), { dataTransfer: { types: ["Files"] } });
    expect(screen.getByText(PROMPT)).toBeTruthy();
  });
  it("2. a non-file dragover shows nothing", () => {
    render(<Harness />);
    fireEvent.dragOver(screen.getByTestId("shell"), { dataTransfer: { types: ["application/x-lasso-container"] } });
    expect(screen.queryByText(PROMPT)).toBeNull();
  });
  it("3. dragleave clears it", () => {
    render(<Harness />);
    const shell = screen.getByTestId("shell");
    fireEvent.dragOver(shell, { dataTransfer: { types: ["Files"] } });
    fireEvent.dragLeave(shell, { dataTransfer: { types: ["Files"] } });
    expect(screen.queryByText(PROMPT)).toBeNull();
  });
  it("4. one file calls the existing upload once with that file", async () => {
    render(<Harness />);
    const [file] = files(1);
    dropAt(screen.getByTestId("shell"), 300, 40, [file!]);
    await waitFor(() => expect(place).toHaveBeenCalled());
    expect(upload).toHaveBeenCalledTimes(1);
    expect((upload.mock.calls[0] as unknown[])[1]).toBe(file);
  });
  it("5. the card is placed at the drop point", async () => {
    render(<Harness />);
    dropAt(screen.getByTestId("shell"), 300, 40, files(1));
    await waitFor(() => expect(place).toHaveBeenCalled());
    expect(place.mock.calls[0]?.[1]).toEqual({ x: 600, y: 80 });
  });
  it("6. twelve files process ten and say so", async () => {
    render(<Harness />);
    fireEvent.drop(screen.getByTestId("shell"), { clientX: 1, clientY: 1, dataTransfer: { types: ["Files"], files: files(12) } });
    await waitFor(() => expect(place).toHaveBeenCalled());
    expect(upload).toHaveBeenCalledTimes(10);
    expect(toastFn).toHaveBeenCalledWith("Added the first 10. Drop the rest in another go.");
  });
  it("7. workitem.captured carries channel drop", async () => {
    render(<Harness />);
    fireEvent.drop(screen.getByTestId("shell"), { clientX: 1, clientY: 1, dataTransfer: { types: ["Files"], files: files(1) } });
    await waitFor(() => expect(place).toHaveBeenCalled());
    expect(logEvent).toHaveBeenCalledWith("workitem.captured", "o1", expect.objectContaining({ channel: "drop", source: "upload", type: expect.any(String) }));
  });
});
