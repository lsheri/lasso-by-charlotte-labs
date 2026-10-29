import type { NavItemId } from "@/components/layout/nav-config";

/** Canonical event registry. Every name here is mirrored to PostHog. */
export type TelemetryEvent =
  /** Founder-only AI accounting: exact cost and usage, never work content. */
  | "ai.usage"
  | "nav.opened"
  | "org.created"
  | "org.tier_changed"
  /** N2: an admin opened the Individual/Business confirm. Fires on open only, never on cancel or on the change. */
  | "org.tier_change_opened"
  /** Unit 4h-a: an admin turned the workspace's client list on or off. The new state only, as "true" or "false". Never a name, never an id. */
  | "org.clients_changed"
  | "onboarding.tools_selected"
  /** KX1: a carried activation key failed to redeem at workspace creation. Closed reason only; never the code, institution or email. Portal needs this name added. */
  | "activation.redeem_failed"
  /** KX1: a carried activation key was removed before workspace creation. Whether its institution lookup had resolved, and nothing else. Portal needs this name added. */
  | "activation.key_removed"
  | "landing.viewed"
  /** B2B landing: a visitor chose either pilot entry point. Location only. */
  | "landing.pilot_cta_clicked"
  /** B2B landing: a visitor chose the hero's product-story link. Location only. */
  | "landing.see_it_work_clicked"
  /** B2B landing: one story section became visible. Closed section and input mode only. */
  | "landing.story_section_viewed"
  /** Unit L1: a visitor chose one of the closed story-section jump controls. */
  | "landing.section_jumped"
  /** Unit L4: a visitor opened the source turn or returned to slide 3 from the proof card. */
  | "landing.proof_link_opened"
  /** Unit L4.1: a visitor opened or closed a source quote inside the proof card. */
  /** Unit 10: a use-case card's clip started on hover or tap. Closed card key and input mode only. */
  | "landing.usecase_played"
  /** B2B landing: a pilot request was saved. Team-size band only. */
  | "landing.pilot_requested"
  /** Unit B1: the public plans page was opened. Content-free. */
  | "plans.viewed"
  /** Unit B1 legacy name. No new callers. */
  | "plans.action_clicked"
  /** Unit D1: a visitor chose one enabled plan. Closed plan and source only. */
  | "plan.picked"
  /** Unit D1: signup opened with a plan intent. Closed intent and source only. */
  | "signup.started"
  | "signup.existing_account"
  | "auth.password_reset"
  /** A sign-in link was requested. Closed outcome word only (sent | cooldown). Portal needs this name added. */
  | "auth.sign_in_link"
  /** Product shell 1.3: the public demo Home or a demo board was opened. Closed surface word and invented demo code only. */
  | "demo.opened"
  /** P1: one content-free interaction in the local-only public demo playground. */
  | "demo.play_interacted"
  /** Product shell 1.3: a card on a demo board was opened to read. Invented demo code and node kind only. */
  | "demo.card_opened"
  /** Unit 2: a saved preset answer was opened on a demo board. Invented demo code and position only. */
  | "demo.preset_opened"
  /** Unit 2: "Open the exact turn" was chosen from a saved demo answer. Invented demo code and position only. */
  | "demo.turn_opened"
  /** Unit 2: a demo org admin regenerated the saved demo answers. Invented demo code and answered count only. */
  | "demo.presets_regenerated"
  /** Unit 3: a visitor completed one real action in the public demo guide. Step and invented demo code only. */
  | "demo.step_completed"
  /** Unit 3: a visitor ended the public demo guide. Step only. */
  | "demo.tour_skipped"
  /** Unit 4: a tool filter chip was chosen on the public demo conversations page. Closed tool word only. */
  | "demo.filter_changed"
  /** P4a: the signed-in Home board was opened. Content-free. */
  | "home.opened"
  /** P4a: the new-engagement dialog was opened from Home. Content-free. */
  | "home.new_engagement_started"
  /** P4a: Past work was opened from Home. Content-free. */
  | "home.past_work_opened"
  /** P4a: a person chose to compose a product-idea email. Never carries their words. */
  | "home.ideas_note_composed"
  /** P4b: an engagement was opened from the Home grid. Content-free. */
  | "home.engagement_opened"
  /** TV4: the first-run tour mounted for a person, once. Register only. */
  | "tour.started"
  /** TV4: an act's action completed and its teaching callout appeared. Act number and register. */
  | "tour.step_done"
  /** TV4: the teaching callout's control advanced the tour. Act number and register. */
  | "tour.step_continued"
  /** TV4: Skip the tour was used. The act number they were on and register. */
  | "tour.skipped"
  /** TV4: the closing act's finish control was used. Register only. */
  | "tour.finished"
  /** Inbox: the bring-work menu was opened. Content-free. */
  | "work.import_menu_opened"
  /** Phone All work: another local page of the list was revealed. Content-free. */
  | "work.list_expanded"
  /** Inbox: an arrivals or reading panel was opened. Closed panel word only. */
  | "work.panel_opened"
  /** Reader: a collapsed run of AI tool steps was opened. Banded count only. */
  | "work.tool_steps_opened"
  /** Chat library: a filter or supporting panel was opened. Closed panel word only. */
  | "chatlib.panel_opened"
  /** Ask Lasso: the persisted response-input disclosure was opened. Count bands only. */
  | "reflect.trail_opened"
  | "workitem.captured"
  | "workitem.mapped"
  | "workitem.marked_private"
  | "workitem.dated"
  /** WI-1: an owner set or cleared the name other people see. dims.cleared is "true" or "false"; never the name. */
  | "workitem.renamed"
  /** BR-1: a person branched work into an AI tool. dims.tool and dims.handoff only; never a name or content. */
  | "workitem.branched"
  /** BR-2: a connected AI tool fetched a branch the person owns. dims.tool and dims.first only. */
  | "workitem.branch_opened"
  /** A work item was deleted for good from the inbox. Content-free. */
  | "workitem.deleted"
  /** M3: an arrival was moved back to the inbox. Whether it was put back again. */
  | "inbox.arrival_undone"
  | "decision.drafted"
  | "decision.confirmed"
  | "decision.resolved"
  /** MCP-DOC-1a: a Decisions document was pushed; source and line-count band only. */
  | "decisions_doc.created"
  /** MCP-DOC-1a: a decision line was added; source and stored-pointer presence only. */
  | "decisions_doc.decision_added"
  /** MCP-DOC-1b: a re-push recorded a version; change and added/dropped bands only. */
  | "decisions_doc.version_recorded"
  /** DOC-UI-1: an owner changed a line's status; status words and source only. */
  | "decisions_doc.decision_status_changed"
  /** DOC-UI-1: an owner changed a ledger line; action and source only. */
  | "decisions_doc.line_changed"
  /** DOC-UI-2a: a link comment was added; booleans only, no viewer identity. Portal row owed. */
  | "decisions_doc.link_comment_added"
  | "connector.enabled"
  | "connector.error"
  | "connector.synced"
  | "connector.watch_enabled"
  | "connector.suggestion_shown"
  | "connector.suggestion_reviewed"
  /** Pass 160: the AI setup steps were opened. Surface and a boolean only. */
  | "connector.setup_opened"
  /** Pass 165: someone loaded a further page of a connector listing. */
  | "connector.browse_paged"
  /** Pass 169: how the first page of a connector listing resolved. */
  | "connector.browse_result"
  /** Pass 173: the connectors surface was opened. Entry point and counts. */
  | "connector.surface_opened"
  | "import.started"
  | "import.parsed"
  | "import.committed"
  | "import.completed"
  | "import.abandoned"
  /** IMPORT-1: an export could not be read. Vendor, screen and a closed reason only. */
  | "import.failed"
  /** GATE-1: a company or partner signup asked for a pilot. Register and team size band only. */
  | "pilot.requested"
  /** PF1: a push through MCP. Dims include stage (options | capture | helper)
   *  and window_pos (only | first | middle | last); the full list lives in
   *  event-dim-allowlist.ts. */
  | "mcp.push"
  /** MCP-T3: a push declared itself; content-free dimensions only. */
  | "mcp.push_intent_declared"
  /** MCP-T3: a push arrived; status and match method, never content or counts. */
  | "mcp.push_intent_completed"
  | "mcp.read"
  /** M3-C2: an MCP call that could not be resolved. Kind and closed reason only. */
  | "mcp.auth_failed"
  /** M2: a named connection was made in Settings. Kind only. */
  | "mcp.connection_created"
  /** M3-C3a: a person declined an AI tool sign-in. Client family only. */
  | "mcp.consent_denied"
  /** M2: a connection was disconnected. Kind and where from. */
  | "mcp.connection_revoked"
  /** M2: a connection link was shown again. Kind only. */
  | "mcp.connection_revealed"
  /** M2a: a model asked where a push could go. Whether there was a signal. */
  | "mcp.push_options_requested"
  /** M2a: a place was made through MCP. Shape only, never a name. */
  | "mcp.container_created"
  /** CL-2b: a chat link was attached to a pushed conversation through MCP.
   *  Dims: source ("mcp"), had_prior_link. Portal needs this name added when it exists. */
  | "mcp.chat_link_attached"
  /** B1d: a container was made in the app, client or folder. Kind, the closed
   *  entry point (empty_state included), workspace type and level only. Never a name, never an id. Compare mcp.container_created,
   *  which is the same act performed by an outside model. */
  | "container.created"
  /** K2: someone submitted an activation key, and what came back. The returned
   *  reason and the closed entry point only. Never the key, never an
   *  institution, never an id. */
  | "activation_key.submitted"
  /** A container was moved under another container, or moved back to the
   *  top. Kind, resulting depth and whether a parent was set or cleared.
   *  Never a name, never an id. */
  | "container.reparented"
  /** Unit 4a: a container was removed through delete_container. Its contents
   *  lift one level. Kind and two booleans only. Never a name, id or count. */
  | "container.deleted"
  /** SB-C1a: a container colour changed. Closed family, kind and entry point only. */
  | "container.colored"
  /** SB-C1a: a container was archived. Kind and booleans only. */
  | "container.archived"
  /** SB-C1a: a container was brought back. Kind and a day band only. */
  | "container.unarchived"
  /** SB-C1b: the archive surface opened. Entry point only. */
  | "container.archive_opened"
  | "workflow.reordered"
  | "workflow.reset"
  | "coach.invite_created"
  | "coach.joined"
  | "coach.engagement_shared"
  | "packet.viewed"
  | "client.page_viewed"
  | "admin.dashboard_viewed"
  | "note.created"
  | "coachchat.asked"
  /**
   * Pass 170: coaching links, person to person. Every one of these carries the
   * basis, relation, access level and scope only. Never a name, never a count
   * shown back to anyone in the product.
   */
  | "coachlink.created"
  /** Pass 171: a coach accepted an invite and picked up the links waiting for them. */
  | "coachlink.claimed"
  | "coachlink.consented"
  | "coachlink.disclosed"
  | "coachlink.withdrawn"
  | "coachlink.ended"
  | "coachlink.item_excluded"
  | "coachlink.item_restored"
  /**
   * C1: on create this carries {created, brief_skipped, has_client} and one
   * additive dim, from: "sidebar" | "sidebar_client" | "client_page" | "home".
   */
  | "engagement.updated"
  /** A person opened or collapsed the engagement Ask rail. */
  | "engagement.ask_rail_toggled"
  | "engagement.panel_content_changed"
  /** A person chose one of the three engagement views. */
  | "engagement.view_changed"
  /** A person changed what the three views are about. */
  | "engagement.scope_changed"
  /** A person opened the one analysis offered by an engagement tab's notecard. */
  | "engagement.tab_analysis_opened"
  /** A person closed an engagement with a wrap-up deliverable. */
  | "engagement.wrap_created"
  | "task.updated"
  | "feedback.submitted"
  | "reflect.session_created"
  /** Dims include answer_retried and additive scope_source, a closed context-origin value. */
  | "reflect.message_sent"
  | "analysis.started"
  | "analysis.run"
  | "analysis.completed"
  | "analysis.failed"
  | "analysis.handoff_acted"
  /** Pass 128: how the reader's intro story resolved. Outcome only. */
  | "analysis.reader_story"
  | "member.deactivated"
  | "member.reactivated"
  | "member.role_changed"
  | "invite.revoked"
  | "invite.email_sent"
  | "invite.blocked"
  /** Seat roster: a partner named people on a provisioned seat request. Count and the fixed source only. Never an email, name, request id or key code. Portal needs this name added. */
  | "seat.named"
  /** Seat roster: seat invitations went out. Count only, nothing about who. Portal needs this name added. */
  | "invite.sent"
  /** Seat roster: a named seat was revoked. Content-free. Portal needs this name added. */
  | "seat.revoked"
  /** Share back: a sponsored person said yes to sharing with their sponsor. Content-free. Portal needs this name added. */
  | "share_back.offered"
  /** Share back: a sponsored person said no thanks. Content-free. Portal needs this name added. */
  | "share_back.declined"
  /** Share back: a partner claimed an offered share back. Content-free. Portal needs this name added. */
  | "share_back.claimed"
  /** Share back: a person let a sponsor see one board. Content-free. Portal needs this name added. */
  | "share_back.engagement_shared"
  /** Share back: a person took one board back from a sponsor. Content-free. Portal needs this name added. */
  | "share_back.engagement_unshared"
  | "oneonone.prepared"
  | "oneonone.saved_to_drive"
  /** Pass C: a person made a dated 1:1 session of their own. No text, no ids. */
  | "oneonone.session_created"
  /** Pass C: a note was pinned to a session. The kind only. */
  | "oneonone.note_added"
  /** Pass C: a note was marked as covered in the hour. The kind only. */
  | "oneonone.note_discussed"
  | "link.drafted"
  | "link.reviewed"
  /**
   * Pass 196: a person drew this edge themselves, in contrast to link.drafted,
   * which is the model proposing one. Never blur the two.
   */
  | "link.drawn"
  | "evidence.opened"
  | "version.recorded"
  | "brief.marked"
  | "brief.cleared"
  | "extract.generated"
  /** Pass 125: one archive search, metered. Counts only, never the question. */
  | "archive.searched"
  /** Pass 138: one Past work search. Counts only, never the description. */
  | "archive.search"
  /** Client-side interaction timing. Emitted only by src/lib/perf-timing.ts. */
  | "perf.interaction"
  /** Hard document load timing. Emitted only by src/lib/pageload-timing.ts. */
  | "perf.pageload"
  /** Content-free client error signal. Emitted only by src/lib/error-signal.ts. */
  | "client.error"
  /** Pass 145: one row per person per ISO week. Counts only, banded. */
  | "presence.active"
  /** Pass 147: a person joined or left research. Choice only. */
  | "consent.research_change"
  /** Pass 148: one captured item, the tool and coarse shape of the work. */
  | "model.used"
  /** One structure proposal attempt. Closed outcomes and size/cost bands only. */
  | "structure.suggested"
  /** Pass 148: the shape of a captured conversation. Bands and counts only. */
  | "thread.shape"
  /** Pass 155: the machine context of one capture. Bands, counts, codes. */
  | "capture.context"
  /** Pass 148: a link between two pieces of work, tool to tool. */
  | "handoff.observed"
  /** Pass 150: what the person said their finished work is. Closed vocab. */
  | "artifact.declared"
  /** Pass 150: how the person said they worked, at the mapping moment. */
  | "workflow.declared"
  /** Pass 153: the banded shape of how one item came to be, at ship time. */
  | "workitem.journey"
  /** Pass 150: a coach's read on work they reviewed. Closed vocab. */
  | "coach.outcome"
  /** Chat library: someone opened the original chat. Tool name only. */
  | "chatlib.source_opened"
  /** Pass 157b: one settled chat library search. Bands only in dims. */
  | "chatlib.search"
  /** Pass 175: how the chat library is shown. Closed vocab, cards or list. */
  | "chatlib.view_changed"
  /** Pass 176: the chat reader was closed. Closed vocab view and how. */
  | "chatlib.reader_closed"
  /** Pass 179: a chat library filter was changed. Closed vocab, no ids. */
  | "chatlib.filter_changed"
  /** CG1: an Inbox filter changed. Closed filter state and result band only. */
  | "work.filter_changed"
  /** Pass 182: the work canvas was opened. Bands only, never ids. */
  | "canvas.opened"
  /** Pass 187: a piece of work was moved on the canvas. Closed vocab, no ids. */
  | "canvas.node_moved"
  /**
   * Pass 198: the canvas was zoomed. A view control: bands and vocabulary
   * only. No zoom values, no ids, no titles. A person's zoom level is about
   * their own eyes and their own screen and is not a dimension.
   */
  | "canvas.zoomed"
  /** Canvas Lab Phase 2: the local work rail changed visibility. State only. */
  | "workboard.rail_toggled"
  /** The person flipped board cards between sketch and real preview. Face only. */
  | "workboard.face_toggled"
  /** The workboard opened, with its content-free entry point. */
  | "workboard.opened"
  /** Canvas Lab Phase 2: a local prototype node was added. Closed kinds only. */
  | "workboard.node_created"
  /** Canvas Lab Phase 2: a local prototype node was removed. Kind only. */
  | "workboard.node_deleted"
  /** Canvas Lab Phase 2: a local note was edited. Kind only. */
  | "workboard.node_edited"
  /** BE-6: content-free answer edit bands and first-edit state. CAT-9 portal registration required. */
  | "answer.edited"
  /** BE-6: the preserved original answer was opened. No dims. */
  | "answer.original_viewed"
  /** Canvas Lab Phase 2: a real record was hidden or restored locally. */
  | "workboard.record_visibility_changed"
  /** Canvas Lab Phase 2: a local relationship changed. Action only. */
  | "workboard.relationship_changed"
  /** Canvas Lab Phase 2: the read-only deliverable reasoning view opened. */
  | "workboard.review_opened"
  /** Read-only Decisions ledger opened. Entry method only. */
  | "workboard.ledger_opened"
  /** Canvas Lab Phase 2: a grouped reasoning-trail item was chosen. */
  | "workboard.trail_item_selected"
  /** Canvas Lab interaction correction: a card's contextual action menu opened. */
  | "workboard.card_menu_opened"
  /** Canvas Lab Phase 3: a durable Workboard change was confirmed. Entity and action only. */
  | "workboard.change_saved"
  /** Canvas Lab Phase 3: a durable Workboard change failed. Entity and closed reason only. */
  | "workboard.save_failed"
  /** Canvas Lab Phase 3: a person settled a newer-version conflict. Entity and choice only. */
  | "workboard.conflict_resolved"
  /** Canvas Lab polish: one completed card or frame resize. Closed geometry vocabulary only. */
  | "workboard.element_resized"
  /** Canvas Lab polish: a move prompt after a drop was answered. Answer only. */
  | "workboard.drop_prompt_answered"
  /** B3a: the built-in sample board was opened. Entry point only. */
  | "workboard.example_viewed"
  | "workboard.display_mode_toggled"
  | "workboard.display_mode_toggled"
  | "workboard.card_content_viewed"
  /** C1: a person chose rendered output or stored source in the enlarged preview. */
  | "work.preview_mode_changed"
  | "work.rendition_viewed"
  | "work.file_downloaded"
  /** Canvas Lab polish: a save error was settled. Entity and choice only. */
  | "workboard.save_error_resolved"
  /** Canvas Lab polish: the local context selection changed. Action only: cleared | marquee | workstream | menu, plus additive "card" (BI-2a, a card body click). */
  | "workboard.context_changed"
  /** Canvas Lab polish: one arranging step was taken back or put back. Closed vocabulary only. */
  | "workboard.undo_used"
  /** Slice 2a: a highlight was made or removed. Closed vocabulary and a length band only. */
  | "workboard.annotation_changed"
  /** MENTION-1c: newly saved board mentions. Surface and recipient count band only. */
  | "workboard.mention_created"
  /** B2: work was brought onto a workboard. Closed source and entry point, plus a count. */
  | "workboard.work_added"
  /** B4: a workstream was drawn on the workboard. Claimed count and whether one prompt was shown. */
  | "workboard.workstream_drawn"
  | "workboard.workstream_created"
  | "workboard.region_named"
  | "workboard.section_created"
  | "workboard.section_filled"
  | "workboard.section_moved"
  | "workboard.section_removed"
  /** SECD-1b: a section's period or number marker changed. Closed dimensions only, no values. */
  | "workboard.section_marker_set"
  | "workboard.section_marker_cleared"
  | "workboard.section_shifted"
  /** SECD-2: the view was panned to a marked section. Entry only, never dates. */
  | "workboard.board_jumped"
  /** B2: a chat's docked pieces were minimized, shown, or all shown. State, count band, entry only. */
  | "workboard.bundle_toggled"
  /** D1: an empty note was started on a workstream. Entry point only, no ids and no text. */
  | "workboard.document_created"
  /** P1b: the person added the file to a placeholder the chat created. Match and entry only. */
  | "workboard.reference_file_added"
  /** Pass 185: a workspace was affiliated with an institution at creation. Slug only. */
  | "workspace.affiliated"
  /** Pass 186: the student opened the page describing what their school sees. */
  | "affiliation.disclosure_read"
  /** Pass 159: a person changed the profile they are acting as. Roles only. */
  | "profile.switched"
  /** MN-1: the stored workspace row differed from this tab's cache; the row won. Source only. */
  | "profile.active_reconciled"
  /** Pass 161: the subject opened notes about their work. One per view. */
  | "coachnote.read"
  /** Pass D: a coach pinned a note with a scope chosen. The scope only. */
  | "coachnote.scoped"
  /** Pass D: someone wrote back on a note. Which side wrote, nothing else. */
  | "coachnote.replied"
  /** Pass E1: /find-it was opened. Closed vocab entry point only. */
  | "findit.opened"
  /** Pass E1: one trace ran. Scope and bands, never ids or titles. */
  | "findit.run"
  /** Pass E1: one look for words that were said. Bands only, never the query. */
  | "findit.searched"
  /** Pass E1: a candidate was shown, with or without a shared sentence. */
  | "findit.quote_shown"
  /** Pass 164: the walkthrough was opened. Variant, entry, banded age only. */
  | "walkthrough.opened"
  /** Pass 164: one walkthrough section was reached. Closed vocab section id. */
  | "walkthrough.section_viewed"
  /** Pass 167: a person settled one subject. Action and a boolean only. */
  | "entity.curated"
  /** Pass 172: the school entry page was opened. No names, no free text. */
  | "edu.join_opened"
  /** Pass 172: a person promoted one piece of work. Closed source section. */
  | "portfolio.item_added"
  /** Pass 172: a person took one piece of work back off the Portfolio. */
  | "portfolio.item_removed"
  /** Pass 155: one piece of work sent to the firm. Boolean and count only. */
  | "firm.work_shipped"
  /** Pass 148: one recheck pass over connected documents. Counts only. */
  | "document.recheck_ran"
  /** Pass 148: one version written by a recheck. Source and reason only. */
  | "document.version_recorded"
  /** Pass 148: the earlier-versions list in the peek was expanded. Count only. */
  | "document.versions_expanded"
  /**
   * W2.1: one piece of AI output was reorganised, either lifted so it stands
   * on its own or put back with its chat. Closed dims only, no ids, no titles,
   * no content: action (stands_alone | put_back), piece_kind (the work item
   * type), vendor (claude | chatgpt | gemini | none) and on_board (whether a
   * card and a produced link were drawn).
   */
  | "work.piece_regrouped"
  /**
   * S1: the expiring board link. Closed dims only, no ids, no tokens, no
   * titles and nothing about whoever opened it, because there is nothing
   * about them to know. action (created | opened | revoked | refused) and,
   * on refused only, reason (expired | revoked | unknown).
   */
  | "board.share_link"
  /** PERF-2c: the board Share dialog went from closed to open. No dims. */
  | "board.share_opened"
  /**
   * T1: a traced question was saved to span_links. Dims: via (short fixed
   * code-path name) only. No ids, text, names or counts.
   */
  | "span_link.created"
  /**
   * S-T1: one saved settings change. Dims: section, setting, change, and
   * to_level for data levels only. Closed lists in settings-events.ts.
   */
  | "settings.changed"
  /**
   * PERF-2c: the visible Settings section changed. Dims: section (fixed nav
   * id), via (rail | deep_link | default).
   */
  | "settings.section_opened"
  /** SH-6d-1: an admin decided a support access request. Dims: approved, conversations ("true" | "false"). */
  | "support.decided"
  /** SH-6d-1: support access was ended early. Dims: by ("grantor"). */
  | "support.ended"
  /** SH-6d-2: Charlotte Labs viewed a surface under a grant. Dims: surface. */
  | "support.viewed"
  /**
   * RQ-1: a partner submitted a workshop key request. Dims: workspace_kind
   * (the request's own), seats_band (1 | 2-5 | 6-20 | 21+), outcome
   * (ok | refused). Never an email, client name, domain, code or name.
   */
  | "key_request.submitted"
  /**
   * S2: someone in the workspace was given, moved between, or taken off the
   * two things a person can have on a board. Closed dims only, no ids, no
   * names, no counts: access (review | work | none) and result (granted |
   * changed | removed | unchanged).
   */
  | "engagement.access_changed"
  /**
   * S5a: a board someone handed this person was opened from "Shared with me".
   * Two bucketed counts and no others: boards_band (boards in the section) and
   * granters_band (people who have shared with this person). It deliberately
   * carries no ids, of either the board or the person who shared it.
   */
  | "shared.board_opened"
  /** SH-7c: a guest left a board shared with them. No dims, no ids. Portal registration required. */
  | "shared.board_left"
  /** NC-2: the notification panel was opened. Dims: needs_you (none | some). */
  | "notification.opened"
  /** NC-2: a notification was acted on. Dims: kind (notification kind), action (approve | decline | open | accept). No ids, names or emails. */
  | "notification.acted"
  /** SH-5c: a board invite by email was created. Dims: kind, status, level, conversations. No emails, codes or ids. */
  | "board.invite_sent"
  /** SHARE-3: one Send in the Share dialog covering one or more addresses or colleagues. Dims: count_band (1 | 2-5 | 6-20), sent, failed, skipped (small integers). No emails, names or ids. */
  | "board.invite_batch_sent"
  /** SH-5c: an open board invite was withdrawn. Dims: kind. */
  | "board.invite_withdrawn"
  /** SH-5d: a board invite was accepted. Dims: kind. */
  | "board.invite_accepted"
  /** F4: a person answered "What will you use Lasso for?". Dims: uses (sorted picks joined by "+"). Never shown to anyone else. */
  | "person.uses_declared";

export type TelemetryDims = Record<
  string,
  string | number | boolean | null | Record<string, number>
>;

/** MN-1: closed source vocabulary for profile.active_reconciled. */
export const PROFILE_RECONCILE_SOURCES = ["row_differs"] as const;
export type ProfileActiveReconciledDims = { source: (typeof PROFILE_RECONCILE_SOURCES)[number] };

/** MN-2b: content-free navigation destinations; portal registration required. */
export type NavOpenedDims = {
  item: NavItemId | "workboards" | "more" | "board" | "workspace" | "recent_board" | "find_result";
  // MN-3b adds look_back, your_coach, connect_tools and create_menu through NavItemId.
  surface: "tab" | "more" | "workboards_sheet" | "sidebar" | "workspace_menu" | "drawer";
};

/** MAP-1: dims for workitem.mapped. Additive; existing keys unchanged. */
export type WorkitemMappedDims = {
  type: string;
  source: string;
  suggested?: boolean;
  entry?: string;
  channel?: string;
  via?: "board" | "mcp" | "list" | "add_work" | "suggestion" | "brief";
  tool?: string;
};

/** How a work item entered Lasso. Content never travels; the channel does. */
export type CaptureChannel = "paste" | "upload" | "import" | "mcp" | "connector";

/** 0 · 1-10 · 11-50 · 51-200 · 200+, counts never leave as exact values. */
export function bucket(n: number): string {
  if (n <= 0) return "0";
  if (n <= 10) return "1-10";
  if (n <= 50) return "11-50";
  if (n <= 200) return "51-200";
  return "200+";
}
