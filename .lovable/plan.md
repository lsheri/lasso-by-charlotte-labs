# IMPORT-1 diagnosis: every import dies on the "file" screen

Diagnosis only. No code was changed.

## 1. Where it lives and the steps

- Dialog and all screen logic: `src/components/work/import/ImportFlowDialog.tsx`
- Reading and parsing the file: `src/lib/import-parsers.ts` (`readImportFiles`, `parseImport`, `parseClaude`, `parseChatGpt`)
- Accepted types and guide text: `src/lib/import-vendors.ts`
- Writing the rows: `src/lib/import-commit.ts` (`commitImport`)
- Opened from: `src/pages/WorkPage.tsx` line 226 (button) and line 767 (inside a `DropdownMenuContent`), plus `ExportGuideCard` (Gemini/Copilot only, so not these users)

Steps: `source` (pick vendor, fires `import.started`) → `file` → `select` (fires `import.parsed`) → `committing` → `done` (fires `import.committed`, `import.completed`) → `organize`.

`import.abandoned` is fired only in `handleOpenChange` (line 77-80): when the dialog closes while a vendor is set and the screen is not `done`/`organize`.

## 2. What the "file" screen asks for

The user must already hold an export from Claude or ChatGPT. Both need an emailed download (Claude minutes, ChatGPT 20 min to 24 h). The screen offers a drop zone and a "Choose file" picker (`accept=".zip,.json"`, multiple). No size check, no type check beyond the picker filter. Everything is read in the browser: a `.zip` is unpacked whole into memory with `unzipSync` and only `conversations.json` / `conversations-NNN.json` are kept; anything else is read as text and must be JSON. No upload, no storage bucket, no policy involved at this step.

On a rejected file: `handleFiles` catches the error and calls `setError(...)`. That is the bug, see H1.

## 3. Is `import.abandoned` trustworthy?

- Fires on dialog close only (X, Escape, clicking outside). Not on unmount, not on route change: if the dialog is unmounted while open, nothing fires at all.
- It does not distinguish "gave up" from "closed after a failure". There is no `import.failed` or error event anywhere in the flow; a parse error emits nothing.
- Verdict: the event is accurate about where they were, misleading about why. It cannot tell giving up from failing.

## 4. Ranked hypotheses

**H1 (most likely): parse errors are invisible on the file screen.**
`error` is only shown on the `select` screen (line 293). On `file`, a thrown error ("Nothing readable in that file", "No conversations could be read from that file.", JSON errors, zip errors) sets state that is never shown. The user drops a file, nothing happens, they close. That matches 90-second abandons, repeated tries over four dates, zero `import.parsed`, zero rows. Common ways to hit it today:
- macOS Safari auto-unzips the download, so the user drops the unzipped folder, or a file that is not `conversations.json` (`users.json`, `projects.json`, `chat.html`).
- A current export format the parser does not recognise. Every record lands in `failures`, conversations = 0, error thrown, invisible.

**H2: a large zip freezes or crashes the tab.** `unzipSync` plus `strFromU8` reads the whole archive synchronously on the main thread. A large ChatGPT history (often hundreds of MB, images included) can freeze the page or run out of memory with no message. Plausible for the long-gap abandons; cannot confirm from code.

**H3: dialog nested inside a dropdown menu (WorkPage line 767).** Radix dialogs inside `DropdownMenuContent` are known to dismiss or unmount when the menu closes, or when focus leaves for the native file picker. If it closes via `onOpenChange(false)` it would log `abandoned` at `file` within seconds. Fits the 2-second abandons. Needs a browser check to confirm.

**H4: genuine giving up.** The user reaches the screen with no export ready, reads "wait for the email", and closes. Also fits the 2-second abandons. The return visits on later dates suggest they did come back with a file, which points back to H1.

Ruled out: storage bucket or policy (nothing uploads before `select`); disabled submit (no submit on this screen); size limit rejecting files (none exists).

## 5. Changes and tests

- No commits to any import file since 17 Aug 2026. Nothing changed between 5 Oct and now.
- Tests: `src/lib/__tests__/import-parsers.test.ts` covers three small parser cases with made-up JSON. Nothing covers the dialog, the zip path, error display, or a real current export.

## Smallest safe fix (for approval, not built)

Two files, no database work:
1. `ImportFlowDialog.tsx`: show `{error}` on the `file` screen under the drop zone, with the paste link beside it. Add a "Reading your export" state while `handleFiles` runs so the user sees it working.
2. Telemetry (gate): add one new event `import.failed` with dims `{vendor, last_screen, reason}`, where `reason` is a closed set (`nothing_readable`, `no_conversations`, `invalid_json`, `zip_error`). This requires additive entries in `telemetry-shared.ts` and `event-dim-allowlist.ts`. Schema is additive only; no existing event changes; no consent surface touched. Never send file names or content.
3. Test: a dialog test where a file with no conversations is dropped and the message appears.

Follow-ups, separate units: move the line-767 importer out of the dropdown (H3) after a browser repro; consider streaming unzip for large archives (H2).

## Cannot be determined from code

- Which file the user actually dropped, or whether they dropped anything (no event exists).
- The current real Claude/ChatGPT export layout. Needs a fresh sample export to test the parser against.
- Which entry point they used (WorkPage button vs dropdown); `import.started` carries no entry dim.
- The six MCP connections created and revoked on 19 Oct are a separate flow (`mcp_connections`), and nothing in this import code explains them. Suggests the user tried every route; worth a separate look.

DECIDE: approve the two-file visible error + `import.failed` fix, and whether to run a browser repro of H3 first.
