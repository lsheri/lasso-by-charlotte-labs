/** At most one recheck pass per profile in this window. */
export const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** At most this many documents get a metadata call in one pass. */
export const RECHECK_BATCH = 25;
/** meta keys holding per-document recheck state. */
export const RECHECK_AT_KEY = "recheck_checked_at";
export const RECHECK_MODIFIED_KEY = "recheck_modified_time";
