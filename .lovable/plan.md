# Unit 4d: correct the sidebar tree shape

## Data platform gate
- Coverage: indentation and connector rendering only. No user action, surface, or flow changes, so no event changes.
- Consent: untouched.
- Schema and portal: no event name, payload, or dimension changes. No database work.

## Current contract

### Interactive controls before and after
- Container name link.
- New workboard button on each container.
- More-actions button and right-click menu on every editable container and workboard row.
- Container collapse and expand button with stored collapse state.
- Workboard links and their existing nested task links.
- Synthetic grouping collapse and expand controls.
- New workboard, New client when permitted, and New folder actions.

The before and after lists match exactly. No control is added, removed, renamed, or moved to a different destination. Workboard rows remain leaves and receive no disclosure control.

### Render states before and after
- Loaded client and folder trees, including empty containers.
- Collapsed containers hiding all descendant folders and workboards.
- `Nothing in here yet` under an open empty container.
- `Not in a client yet` as an italic synthetic grouping with no container icon.
- Split client and Folders sections as decided by `splitsByKind`.
- Guest navigation built only from joined workboards, without a clients-table read.
- Existing loading and empty workboard states.

The state list is unchanged. Only the geometry of loaded tree rows changes.

### Existing event calls before and after
- No event is emitted by indentation, guide rendering, collapse, or expand.
- Existing sidebar events and payloads remain untouched.

## Diagnosis
- `flattenForSidebar` correctly returns depths 0, 1, and 2 for the reported tree.
- `FolderRows` passes that number into `ContainerShelfRow`.
- In `src/components/layout/SidebarNav.tsx`, the current `depth > 0` branch renders one identical `PencilIndent` for every nested container. Depth 1 and depth 2 therefore become visually identical.
- Nested workboards use a separate fixed `nb-nav-item-nested` indent, so a workboard and folder under the same parent do not share one coordinate system.

## Implementation
- Replace the boolean nested-container indent in `SidebarNav.tsx` with recursive branch rendering based on the existing `ContainerNode.children` tree.
- Use one fixed indent step for every level. A container at depth N and a workboard directly inside it at depth N+1 use the same row geometry as every other item at that depth.
- Render each open container’s descendants inside one quiet, hairline guide wrapper. Nested wrappers create one continuous guide per open ancestor level. Each wrapper ends after its final visible child, so the final child closes that level’s line naturally.
- Keep depth 0 flush with no guide.
- Keep the existing icons, weights, links, menus, creation buttons, collapse state storage, empty line, synthetic groupings, section split, and guest data path unchanged.
- Use existing semantic pencil and muted tokens only. No boxes, new colour literals, or heavy rules.

## Regression coverage
- Extend the sidebar rendering test with the exact reported fixture: `ABC co`, `CURE test`, `folder 01`, `B5-TEST2 test`, `folder1`, and two root `test` folders.
- Assert rendered depth attributes or classes, not only source-tree depth:
  - `ABC co` at 0.
  - `CURE test` and `folder 01` at 1.
  - `B5-TEST2 test` and `folder1` at 2.
- Preserve the existing DOM-order assertions proving nesting.
- Collapse `folder 01` through its accessible button and assert both `B5-TEST2 test` and `folder1` disappear together.
- Run `pass210-sidebar-tree`, `pass212-nested-folders`, `unit4a-move-delete`, and `unit4c-client-mint-gate`, then the project typecheck and full suite.

## Visual verification
- Open the signed-in preview as Liam without creating or changing rows.
- Capture the existing three-level sidebar at 1280px and 390px.
- Check that folder and workboard siblings align, the grandchild folder is one step deeper, guide lines are traceable to parents, final-child lines close, menus remain reachable, and no text or controls overlap.
- If this external authentication setup still prevents preview access, report that limitation plainly rather than claiming visual verification.

## Files expected to change
- `src/components/layout/SidebarNav.tsx`: shared depth geometry and recursive guide rendering.
- `src/styles.css`: quiet guide-line and fixed-step tree layout styles using existing tokens.
- `src/lib/__tests__/pass210-sidebar-tree.test.tsx`: exact live-shape rendered-depth and collapse regression.
- `roadmap.md`: Unit 4d completion state only.
