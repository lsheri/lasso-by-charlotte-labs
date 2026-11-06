// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SourceGrid, type SourceRow } from "@/components/connectors/SourceGrid";

afterEach(cleanup);

const rows: SourceRow[] = [
  { id: "gmail", name: "Gmail", brand: "gmail", connected: false },
  { id: "googledrive", name: "Google Drive", brand: "googledrive", connected: true },
  { id: "claude", name: "Claude", brand: "claude", connected: true, ai: true },
  { id: "chatgpt", name: "ChatGPT", brand: "chatgpt", connected: false, ai: true },
];

const ids = () => [...document.querySelectorAll("[data-source]")].map((el) => el.getAttribute("data-source"));
const tile = (id: string) => document.querySelector(`[data-source="${id}"]`) as HTMLElement;

describe("ADD-1 SourceGrid", () => {
  it("puts connected apps before not-connected apps", () => {
    render(<SourceGrid rows={rows} onPick={() => undefined} />);
    expect(ids().slice(0, 2)).toEqual(["googledrive", "gmail"]);
  });

  it("renders AI rows after the hr and the AI tools label", () => {
    render(<SourceGrid rows={rows} onPick={() => undefined} />);
    const hr = document.querySelector("hr") as HTMLElement;
    const label = screen.getByText("AI tools");
    expect(hr.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(label.compareDocumentPosition(tile("claude")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tile("gmail").compareDocumentPosition(hr) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("calls onPick with the id", () => {
    const onPick = vi.fn();
    render(<SourceGrid rows={rows} onPick={onPick} />);
    fireEvent.click(tile("gmail"));
    expect(onPick).toHaveBeenCalledWith("gmail");
  });

  it("reads Connect on a not-connected tile", () => {
    render(<SourceGrid rows={rows} onPick={() => undefined} />);
    expect(tile("gmail").textContent).toContain("Connect");
    expect(tile("gmail").getAttribute("data-off")).toBe("true");
    expect(tile("googledrive").textContent).toContain("Connected");
  });

  it("AI rows read Sends work here when connected and Set up in Settings when not", () => {
    render(<SourceGrid rows={rows} onPick={() => undefined} />);
    expect(tile("claude").textContent).toContain("Sends work here");
    expect(tile("chatgpt").textContent).toContain("Set up in Settings");
  });
});
