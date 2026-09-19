# Workboard polish 2d: paper

Data impact: none. No user action, consent surface, event schema, portal entry, or stored data changes.

## Control inventory before and after

The inventories are identical.

- Card root: pointer press, focus, context-menu click, Shift+F10, ContextMenu key, Enter/Space context toggle, and existing keyboard movement/removal behavior.
- Local note textarea: typing, pointer isolation, and blur save.
- Four resize handles: pointer resize, arrow-key resize, double-click Fit content.
- Four edge anchors: pointer connection and Enter/Space two-step connection.
- Ellipsis card menu: Use as context/Remove context, Preview, conditional Fit content, conditional Branch, conditional Move to workstream choices, and ownership-aware Delete local node/Remove from canvas/disabled author message.

## Render-state inventory before and after

The inventories are identical: selected/in-context, focused, connecting, active source anchor, menu open/closed, compact/standard/expanded, local/durable, yours/teammate/draft, editable/read-only, structured/freeform frame choices, and measured paper height.

## Telemetry inventory before and after

Neither `LabCard` nor `LabCardMenu` emits telemetry directly. Their existing callbacks still reach the same page-level events with the same dimensions. All 18 Workboard events remain unchanged and reachable.

## Visual change

Every card kind now uses the same tier-aware paper anatomy: factual glyph and micro labels, owner, handwritten title, available summary, and expanded factual footer.
## Follow-up 2 (b60bf7d)

Data impact: none. Controls, states, events, consent, and schema unchanged; the header/title no longer shrink, the source label truncates with an ellipsis, and the compact header drops the date (it stays in the expanded footer). The compact judgment editor now fills only the remaining body space with min-height 0 and overflow auto.
