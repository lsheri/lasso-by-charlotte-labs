import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { TOOL_PATHS, ToolButton, Toolbar } from "@/design/reference/Toolbar";

type ToolName = keyof typeof TOOL_PATHS;

/** The board tool group, from src/design/reference/Toolbar.tsx: one tool held at a time. */
function ToolGroup({ touch }: { touch: boolean }) {
  const [held, setHeld] = useState<ToolName>("cursor");
  return (
    <Toolbar touch={touch}>
      {(Object.keys(TOOL_PATHS) as ToolName[]).map((name) => (
        <ToolButton
          key={name}
          d={TOOL_PATHS[name]}
          label={name}
          held={held === name}
          touch={touch}
          onClick={() => setHeld(name)}
        />
      ))}
    </Toolbar>
  );
}

const meta = {
  title: "Reference/Toolbar",
  component: ToolGroup,
  args: { touch: false },
} satisfies Meta<typeof ToolGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 29px tools for a pointer. */
export const Desktop: Story = {};

/** 44px targets for touch and below 768px. */
export const Touch: Story = { args: { touch: true } };
