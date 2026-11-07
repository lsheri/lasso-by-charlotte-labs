/**
 * FIX-1: the inline window, sized in tokens and converted to stored
 * characters at the ratio measured on real boards, not the 4 chars per token
 * of plain English prose.
 *
 * Measured 7 Nov 2026: D8 - Liam Plan stored 642,092 chars and reached the
 * model as 385,057 tokens (1.67 chars per token, once turn blocks, headers,
 * the record index and docx tables are counted). The whole record, sized at
 * the old 4:1, reached 1,161,851 tokens and the provider refused it.
 */
export const CHARS_PER_TOKEN = 1.6;

/** The 1M window less the answer (8k), the prompts, the record index and a margin. */
export const INLINE_TOKEN_BUDGET = 860_000;

/** Stored characters that fit inline. Above this the read set is catalogued. */
export const INLINE_CHAR_BUDGET = Math.floor(INLINE_TOKEN_BUDGET * CHARS_PER_TOKEN);
