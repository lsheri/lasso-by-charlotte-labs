/**
 * FLAGS-1 (10 Nov, Liam): every user sees every feature, now and for the foreseeable future. Feature flags
 * are set up only for future needs, as the product and its users develop.
 *
 * The Ask redesign (8 Nov decisions: idle bar, status in the title bar, compact composer, reading chips and
 * receipt, pinned-answer edit, continue in your AI) is therefore the Ask panel for everyone. It changes what
 * Ask looks like, never what it reads (golden set run 3: same answers on and off).
 *
 * This is not a flag: nothing reads PostHog for it. The old-panel branches that still test it are removed in
 * a follow-up (ASK-V2-CLEANUP), so this constant and those branches go together.
 */
export const ASK_V2 = true as const;
