import { describe, expect, it } from "vitest";

import { CHAT_LINK_COPY } from "@/components/canvas-lab/ChatLinkDialog";
import { chatLinkAction, itemChatLink } from "@/lib/chat-url";

const URL = "https://claude.ai/chat/0f8fad5b-d9cb-469f-a165-70867728950e";
const PROJECT = "a1b2c3d4-e5f6-4789-9abc-def012345678";

describe("LINK-1 chat-link rungs and owner labels", () => {
  it("returns the pasted rung for a real pasted URL", () => {
    expect(itemChatLink({ meta: { chat_url: URL } })).toEqual({ url: URL, kind: "pasted" });
  });
  it("returns the project rung when only a project exists", () => {
    expect(itemChatLink({ source_meta: { source_project: { id: PROJECT } } })).toEqual({ url: `https://claude.ai/project/${PROJECT}`, kind: "project" });
  });
  it("returns null when neither exists", () => {
    expect(itemChatLink({})).toBeNull();
  });
  it("chooses add when there is no pasted link, including a project fallback", () => {
    expect(CHAT_LINK_COPY[chatLinkAction(null)]).toBe(CHAT_LINK_COPY.add);
    expect(CHAT_LINK_COPY[chatLinkAction("javascript:alert(1)")]).toBe(CHAT_LINK_COPY.add);
  });
  it("chooses change when there is a pasted link", () => {
    expect(CHAT_LINK_COPY[chatLinkAction(URL)]).toBe(CHAT_LINK_COPY.change);
  });
});