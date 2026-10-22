import { useCallback, useEffect, useState } from 'react';
import type { CardFace } from './FaceToggle';

/**
 * useCardFace. The person's chosen card face for one surface, remembered on
 * this device (localStorage) and kept in step across open tabs. It is the
 * person's own view setting: it describes how they like to see work,
 * nothing about them.
 *
 * One key per surface, because each surface has its own default: a board
 * opens on the real work, a list opens on sketches. Use BOARD_FACE_KEY with
 * fallback 'preview' and LIST_FACE_KEY with fallback 'art'.
 *
 * In the app this should move to the user's settings record so it follows
 * them across devices; the storage keys and values stay the same.
 */

export const CARD_FACE_KEY = 'lasso.cardFace';
export const BOARD_FACE_KEY = 'lasso.cardFace.board';
export const LIST_FACE_KEY = 'lasso.cardFace.list';

function read(key: string, fallback: CardFace): CardFace {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v === 'art' || v === 'preview' ? v : fallback;
  } catch {
    return fallback;
  }
}

export function useCardFace(fallback: CardFace = 'art', key: string = CARD_FACE_KEY): [CardFace, (face: CardFace) => void] {
  const [face, setFaceState] = useState<CardFace>(() => read(key, fallback));

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setFaceState(read(key, fallback));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, fallback]);

  const setFace = useCallback(
    (next: CardFace) => {
      setFaceState(next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        /* Private mode or storage full: the choice holds for this session only. */
      }
    },
    [key],
  );

  return [face, setFace];
}

/**
 * Per-card overrides of the board-wide face. One key per board, a JSON object
 * of node id to face, kept on this device only. Never written to the board:
 * one person's view must not change what a colleague sees.
 */
export const CARD_FACE_OVERRIDE_PREFIX = 'lasso.cardFace.node.';

export function cardFaceOverrideKey(boardId: string): string {
  return `${CARD_FACE_OVERRIDE_PREFIX}${boardId}`;
}

export function effectiveCardFace(overrides: Record<string, CardFace>, nodeId: string, boardFace: CardFace): CardFace {
  return overrides[nodeId] ?? boardFace;
}

function readOverrides(boardId: string | undefined): Record<string, CardFace> {
  if (typeof window === 'undefined' || !boardId) return {};
  try {
    const raw = window.localStorage.getItem(cardFaceOverrideKey(boardId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, CardFace> = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === 'art' || v === 'preview') out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function useCardFaceOverrides(boardId: string | undefined): {
  overrides: Record<string, CardFace>;
  setOverride: (nodeId: string, face: CardFace) => void;
  clearOverrides: () => void;
} {
  const [overrides, setOverrides] = useState<Record<string, CardFace>>(() => readOverrides(boardId));

  useEffect(() => {
    setOverrides(readOverrides(boardId));
    if (typeof window === 'undefined' || !boardId) return;
    const key = cardFaceOverrideKey(boardId);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setOverrides(readOverrides(boardId));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [boardId]);

  const setOverride = useCallback(
    (nodeId: string, face: CardFace) => {
      setOverrides((current) => {
        const next = { ...current, [nodeId]: face };
        if (boardId && typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(cardFaceOverrideKey(boardId), JSON.stringify(next));
          } catch {
            /* Private mode or storage full: the choice holds for this session only. */
          }
        }
        return next;
      });
    },
    [boardId],
  );

  const clearOverrides = useCallback(() => {
    setOverrides({});
    if (!boardId || typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(cardFaceOverrideKey(boardId));
    } catch {
      /* Private mode: nothing to clear beyond this session. */
    }
  }, [boardId]);

  return { overrides, setOverride, clearOverrides };
}
