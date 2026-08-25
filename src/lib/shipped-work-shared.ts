/**
 * Pass 111: shipping finished work to the firm archive. The card is a copy the
 * owner chose to send; the record itself stays with them. Nothing here is ever
 * about the person: the only numbers are facts about the work.
 */

export const SHIP_ACTION_LABEL = "Ship to firm";

export const SHIP_CONFIRM_TITLE = "Ship to the firm archive";
export const SHIP_CONFIRM_BODY =
  "Ship finished work only. The firm will see this card, who shipped it, and its journey. Shipping the same work again replaces the card, it never duplicates.";
export const SHIP_CONFIRM_PRIMARY = "Ship it";
export const SHIP_CONFIRM_SECONDARY = "Not yet";

export const TAKE_BACK_LABEL = "Take back";
export const TAKE_BACK_CONFIRM_LINE =
  "Takes this card out of the archive. The work is untouched.";

export const ARCHIVE_TITLE = "The archive";
export const SHOWCASE_TITLE = "Shipped";
export const SHOWCASE_LINK_LABEL = "See the archive";

/** The home showcase never grows past this many cards. */
export const SHOWCASE_CAP = 6;

export type ShippedCard = {
  id: string;
  work_item_id: string;
  engagement_id: string | null;
  shipped_at: string;
  shipped_by: string;
  shipped_by_name: string | null;
  title: string;
  type: string;
  source: string | null;
  source_vendor: string | null;
  /** Opaque provider evidence, carried so the card can wear the right mark. */
  source_meta: { mime?: string | null; mime_type?: string | null; vendor?: string | null } | null;
  meta: {
    mime_type?: string | null;
    source_mime?: string | null;
    web_view_link?: string | null;
  } | null;
  owner_id: string | null;
  work_date: string | null;
  created_at_source: string | null;
  engagement_code: string | null;
  client_label: string | null;
  /** The engagement this work belongs to: the card's headline. */
  engagement_title: string | null;
  /** The engagement brief, said in two lines under the headline. */
  engagement_brief: string | null;
  /** Pieces of work in the engagement record behind this card. */
  record_items: number;
  /** Provenance stitches that traced a fact back to the record. */
  traced_facts: number;
};

/**
 * Counts about the work, never about the person. Only the parts that are real
 * are spoken, and at zero the line does not exist at all.
 */
export function recordFactsLine(card: {
  record_items: number;
  traced_facts: number;
}): string | null {
  const parts: string[] = [];
  if (card.record_items > 0) {
    parts.push(
      `${card.record_items} piece${card.record_items === 1 ? "" : "s"} of work in the record`,
    );
  }
  if (card.traced_facts > 0) {
    parts.push(`${card.traced_facts} fact${card.traced_facts === 1 ? "" : "s"} traced`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
