# Unit 4c: client creation access

## Data platform gate
- Coverage: changes visibility only. No user action or event is added, removed, or renamed. Existing `container.created` still covers successful client and folder creation.
- Consent: no consent surface, consent storage, or event stamping changes.
- Schema and portal: no event name, payload, or dimension changes. No portal update is needed.

## Control and state contract

### Before
- Sidebar: `New client` and `New folder`; creation input; Add button; Enter submits; Escape closes; pending disables Add.
- Picker: existing-container dropdown; rename button for a selection; `New client`; `New folder`; create/rename input; Add or Save; Enter submits; pending disables submit; refusal/error display.
- Successful creation calls the existing `container.created`; refused creation emits no event and its database message reaches the existing error toast.

### After
- Admin or lead: every control and state above remains unchanged.
- Other roles: `New client` is absent in both places. Every folder, dropdown, rename, workboard, loading, pending, success, and refusal path remains unchanged.
- The two lists differ only by the explicitly requested removal of `New client` for roles that cannot manage members.

## Implementation
- Import and call the existing `canManageMembers(profile)` in `SidebarCreateActions` and `ClientPicker`; do not introduce another role predicate.
- Gate only the client action. Keep `New folder` unconditional wherever the workspace vocabulary separates clients from folders.
- Keep creation writes and error handling unchanged so stale requests still show the database message verbatim.
- Standardize the container menu and confirmation verb to `Delete` in all three copy fields, and update pinned expectations.
- Add regression coverage proving `em` cannot see client creation, `lead` can, folders remain available, and the decision flows through `canManageMembers`.

## Verification
- Run focused tests, the project typecheck command, and the full test suite.
- Inspect the preview at 1280px and 390px where authentication permits; report any authentication limitation separately.
- Confirm the latest preview build result and separate existing failures from new failures.
