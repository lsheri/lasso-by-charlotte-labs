import * as React from 'react';
import { SketchCard } from './SketchCard';
import { BoardCard } from './BoardCard';
import type { Work } from './work-types';
import type { CardFace } from './FaceToggle';

/**
 * WorkFace. One slot, either face. Art is SketchCard, preview is BoardCard,
 * at the same width and height so flipping the toggle never moves the grid.
 *
 * NOTE for the board: LabCard does NOT use this. It branches on the face
 * itself, because BoardCard there also takes `actions`, `provenance` and
 * `headerInsetRight`, which SketchCard does not accept. This slot stays the
 * design system's canonical form for the simple case.
 */

export type WorkFaceProps = {
  work: Work;
  face: CardFace;
  width?: number;
  height?: number;
  inHand?: boolean;
  dimmed?: boolean;
  onSelect?: (work: Work) => void;
  onOpen?: (work: Work) => void;
};

export function WorkFace({ face, width = 240, height = 260, ...rest }: WorkFaceProps) {
  return face === 'art' ? (
    <SketchCard key="art" width={width} height={height} {...rest} />
  ) : (
    <BoardCard key="preview" width={width} height={height} {...rest} />
  );
}
