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
