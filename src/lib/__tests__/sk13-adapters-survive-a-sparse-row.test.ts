/**
 * SK-13. The adapters must tolerate every row shape their HOSTS supply, not
 * just the shape one host supplies. Hosts: the All work / AI record lists
 * (full rows with work_item_tasks and extracts) and the workboard (LabCard,
 * whose rows can arrive without work_item_tasks). A sparse board row once
 * crashed the whole board with `undefined[0]`.
 *
 * Sparse shape read from BOARD_NODE_ITEM_SELECT in src/hooks/use-board-node-items.ts.
 */
import { describe, expect, it } from 'vitest';
import { workToBoardCard } from '../work-board-card';
import { workToSketch } from '../work-sketch';
import type { WorkItemRow } from '../work-types';

const absent = {
  id: 'w1', owner_id: 'u1', orig_conversation_id: null, ungrouped_at: null,
  title: 'Board piece', display_title: null, type: 'ai_thread', source: 'mcp:claude',
  visibility: 'mapped', captured_at: '2026-10-13T12:00:00Z', content_ref: null,
  created_at_source: null, work_date: null, content_fidelity: null,
  source_vendor: 'claude', source_meta: null, meta: null,
} as unknown as WorkItemRow;

const empty = { ...absent, work_item_tasks: [], work_item_extracts: [] } as unknown as WorkItemRow;

describe.each([['absent arrays', absent], ['empty arrays', empty]])('sparse row: %s', (_, row) => {
  it('workToSketch does not throw', () => {
    expect(() => workToSketch(row)).not.toThrow();
  });

  it('workToBoardCard does not throw with undefined previews', () => {
    expect(() => workToBoardCard(row)).not.toThrow();
    expect(() => workToBoardCard(row, undefined, undefined)).not.toThrow();
  });

  it('carries no board key without a placement', () => {
    expect(workToSketch(row)).not.toHaveProperty('board');
    expect(workToBoardCard(row)).not.toHaveProperty('board');
  });
});
