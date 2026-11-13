import type { Meta, StoryObj } from "@storybook/react-vite";

import { NAV_ICONS, NavRow } from "@/design/reference/NavRow";

/** The decided sidebar row, from src/design/reference/NavRow.tsx. The live sidebar copies its values. */
const meta = {
  title: "Reference/NavRow",
  component: NavRow,
  args: { label: "All work", icon: NAV_ICONS.work },
  decorators: [
    (Story) => (
      <div style={{ width: 260 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NavRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Active: Story = { args: { active: true } };

export const WithCount: Story = {
  args: { label: "Conversations", icon: NAV_ICONS.conversations, count: 12 },
};

/** A board row tints its glyph with the board's hashed hue, never its label. */
export const BoardHue: Story = {
  args: { label: "Q4 planning", icon: NAV_ICONS.workboard, hue: 3 },
};

/** Nesting, as the sidebar tree draws it. */
export const Tree: Story = {
  render: () => (
    <div style={{ width: 260, display: "grid", gap: 2 }}>
      <NavRow label="Home" icon={NAV_ICONS.home} />
      <NavRow label="Northwind" icon={NAV_ICONS.client} />
      <NavRow label="Q4 planning" icon={NAV_ICONS.workboard} depth={1} hue={3} active />
      <NavRow label="Pricing review" icon={NAV_ICONS.workboard} depth={2} hue={6} />
      <NavRow label="History" icon={NAV_ICONS.history} />
    </div>
  ),
};
