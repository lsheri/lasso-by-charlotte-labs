import * as React from 'react';
import { useState } from 'react';

/**
 * FaceToggle. Sketch or Real. A TOOL, not an action: it holds, it never
 * fires. Same group treatment as Toolbar (light graphite, one held at a
 * time), acid on the held option, hover the only transition. With words on,
 * the held option shows its word beside the glyph; with words off it is
 * glyph only and the hint rides the tooltip or aria-label.
 */

export type CardFace = 'art' | 'preview';

export type FaceToggleProps = {
  value: CardFace;
  onChange: (face: CardFace) => void;
  words?: boolean;
  touch?: boolean;
  label?: string;
};

export const FACE_WORD: Record<CardFace, string> = {
  art: 'Sketch',
  preview: 'Real',
};

export const FACE_HINT: Record<CardFace, string> = {
  art: 'Show a sketch of each piece of work',
  preview: 'Show the real work, scaled',
};

const GLYPH: Record<CardFace, string> = {
  art: 'M3.5 14c1.8-3.6 3.4-5 4.9-3.5S8 14 10 14s2.6-3 3.6-4.5M13.5 20.5l1-3 5.2-5.2a1.4 1.4 0 0 1 2 2l-5.2 5.2z',
  preview: 'M6 3h8l4 4v14H6zM14 3v4h4M9 11h6M9 14h6M9 17h4',
};

function FaceGlyph({ face, size }: { face: CardFace; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={GLYPH[face]} />
    </svg>
  );
}

function FaceOption({ face, held, words, touch, onChange }: {
  face: CardFace;
  held: boolean;
  words: boolean;
  touch?: boolean | undefined;
  onChange: (face: CardFace) => void;
}) {
  const [hover, setHover] = useState(false);
  const size = touch ? 44 : 29;
  const glyph = touch ? 19 : 15;
  return (
    <button
      type="button"
      aria-label={FACE_HINT[face]}
      title={FACE_HINT[face]}
      aria-pressed={held}
      onClick={() => onChange(face)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        minWidth: size, height: size, minHeight: size, padding: words && held ? '0 8px' : 0,
        border: 0, borderRadius: 'var(--radius-md-new)',
        background: held ? 'var(--hand-live)' : hover ? 'color-mix(in srgb, var(--text-primary) 8%, transparent)' : 'transparent',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: held ? 600 : 400,
        cursor: 'pointer',
        transition: 'background var(--dur-quick) var(--ease-standard)',
      }}
    >
      <FaceGlyph face={face} size={glyph} />
      {words && held ? FACE_WORD[face] : null}
    </button>
  );
}

export function FaceToggle({ value, onChange, words = true, touch, label = 'Show work as' }: FaceToggleProps) {
  return (
    <div
      role="group"
      aria-label={label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: touch ? 4 : 2, padding: touch ? 6 : 4,
        borderRadius: 'var(--radius-md-new)',
        background: 'linear-gradient(176deg, var(--neutral-20), var(--neutral-30))',
        boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--surface-raised) 70%, transparent)',
      }}
    >
      <FaceOption face="art" held={value === 'art'} words={words} touch={touch} onChange={onChange} />
      <FaceOption face="preview" held={value === 'preview'} words={words} touch={touch} onChange={onChange} />
    </div>
  );
}

export { useCardFace, CARD_FACE_KEY, BOARD_FACE_KEY, LIST_FACE_KEY } from './useCardFace';
export { WorkFace } from './WorkFace';
export type { WorkFaceProps } from './WorkFace';
