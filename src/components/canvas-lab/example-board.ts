/**
 * A built-in sample board, shown read only so a person can see what a finished
 * board looks like before they have one of their own.
 *
 * Everything here is fictional and static. No database read, no write, nothing
 * saved to the account.
 */

import type { LabFrame, LabLink, LabNode } from "@/components/canvas-lab/canvas-lab-model";

export const EXAMPLE_CLIENT = "Northwind Grocers";
export const EXAMPLE_ENGAGEMENT = "Pricing pilot design";

export const EXAMPLE_FRAMES: LabFrame[] = [
  { id: "foundation", name: "Foundation", x: 40, y: 40, width: 320, height: 240 },
  { id: "market-scan", name: "Market scan", x: 400, y: 40, width: 300, height: 400 },
  { id: "tier-2", name: "Tier 2 modelling", x: 740, y: 40, width: 300, height: 400 },
  { id: "decisions", name: "Decisions", x: 400, y: 480, width: 300, height: 200 },
  { id: "outputs", name: "Outputs", x: 740, y: 480, width: 300, height: 200 },
];

export const EXAMPLE_NODES: LabNode[] = [
  {
    id: "example-brief",
    kind: "brief",
    frame: "foundation",
    title: "The brief",
    summary:
      "Northwind wants a pricing model that holds if store volumes fall. Recommend one option for the regional pilot.",
    typeLabel: "brief",
    ownership: "yours",
    x: 64,
    y: 96,
    width: 272,
    height: 152,
  },
  {
    id: "example-scan",
    kind: "work",
    frame: "market-scan",
    title: "Competitor pricing scan",
    summary: "ChatGPT chat",
    typeLabel: "chat",
    ownership: "yours",
    x: 434,
    y: 96,
    width: 232,
    height: 112,
  },
  {
    id: "example-volumes",
    kind: "source",
    frame: "market-scan",
    title: "store-volumes-2025.xlsx",
    summary: "Uploaded spreadsheet",
    typeLabel: "sheet",
    ownership: "yours",
    x: 434,
    y: 256,
    width: 232,
    height: 112,
  },
  {
    id: "example-sensitivity",
    kind: "work",
    frame: "tier-2",
    title: "Tier 2 volume sensitivity",
    summary: "Claude chat",
    typeLabel: "chat",
    ownership: "yours",
    x: 774,
    y: 96,
    width: 232,
    height: 112,
  },
  {
    id: "example-judgment",
    kind: "judgment",
    frame: "tier-2",
    title: "Caveat: the 2025 volume figure is unverified. Treat as directional.",
    summary: "Added constraint",
    typeLabel: "judgment",
    ownership: "yours",
    judgmentType: "added_constraint",
    x: 774,
    y: 256,
    width: 232,
    height: 128,
  },
  {
    id: "example-decision",
    kind: "decision",
    frame: "decisions",
    title: "Go with tiered pricing over usage-based",
    summary: "Confirmed by the team",
    typeLabel: "decision",
    ownership: "yours",
    x: 434,
    y: 536,
    width: 232,
    height: 112,
  },
  {
    id: "example-deck",
    kind: "deliverable",
    frame: "outputs",
    title: "northwind-pricing-deck-v3.pptx",
    summary: "Deck sent to the client",
    typeLabel: "deck",
    ownership: "yours",
    deliverable: true,
    x: 774,
    y: 536,
    width: 232,
    height: 112,
  },
];

export const EXAMPLE_LINKS: LabLink[] = [
  { id: "example-link-scan", fromId: "example-scan", toId: "example-deck", fromAnchor: "bottom", toAnchor: "top", relation: "informed" },
  { id: "example-link-sensitivity", fromId: "example-sensitivity", toId: "example-deck", fromAnchor: "bottom", toAnchor: "top", relation: "informed" },
  { id: "example-link-volumes", fromId: "example-volumes", toId: "example-sensitivity", fromAnchor: "right", toAnchor: "left", relation: "cited" },
  { id: "example-link-judgment", fromId: "example-judgment", toId: "example-deck", fromAnchor: "bottom", toAnchor: "top", relation: "revised" },
  { id: "example-link-decision", fromId: "example-decision", toId: "example-deck", fromAnchor: "right", toAnchor: "left", relation: "informed" },
];

/** The stage the sample board is drawn on, with room around the outlines. */
export const EXAMPLE_BOARD_SIZE = { width: 1096, height: 736 };
