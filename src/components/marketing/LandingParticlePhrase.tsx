// ============= Full file contents =============

/**
 * Landing phrase treatment: each word appears in ink, then shifts to neon
 * orange, holds for five seconds, fades out, and the loop repeats.
 * The colour move is a pure CSS keyframe loop; no drawing surface involved.
 */
export const PARTICLE_TEXT_HOLD_MS = 5000;
export const PARTICLE_TEXT_CYCLE_MS = 7600;

export function LandingParticlePhrase({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <span className="landing-particle-phrase" aria-label={text}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <span className="landing-particle-word" aria-hidden="true">
            <span className="landing-particle-word-text">{word}</span>
          </span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}
