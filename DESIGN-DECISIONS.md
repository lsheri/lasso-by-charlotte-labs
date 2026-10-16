# Design decisions

One row per design decision. Owner: L = Liam, C = Claude architect, M = Magic OS agent. A token change or design decision adds or amends its row here in the same change; without the row it is incomplete.

| Date | Owner | Decision | Alternatives that lost | Status |
|---|---|---|---|---|
| 13 Oct 2026 | L | Magic Patterns OS is the design workbench; the Figma file is retired to archive | keep Figma as token source | Decided |
| 13 to 14 Oct 2026 | L | Palette Bone and Acid; soft furniture (1px border, soft shadow, 2px card radius); 5px button radius | hard furniture (3px offset); pill and square shapes | Decided |
| 14 Oct 2026 | L | Type pairing D: Young Serif display, Archivo UI, Martian Mono micro, Architects Daughter hand | A Instrument Serif/Caveat/JetBrains, B Space Grotesk, C Fraunces, E Schibsted; six other hand faces | Decided |
| 14 Oct 2026 | L | Work card face G: source mirror, source colour as left stripe, no verification state on the face, hatched spine for No board | verification chip on the face | Decided |
| 14 Oct 2026 | L | "You are here" in the sidebar is the acid catch loop (900ms, ease-catch), plus sunk fill and weight 600; settings rail and Ask tabs keep the 2.5px acid inset or bottom rule | catch in ink, acid rule only, sunk only, stroke; filled pills | Decided |
| 14 Oct 2026 | L | Board hue: eight hashed hues on the board glyph only; a hue is a name, never a status; never touches a work card | dot, edge, canvas-only, none | Decided |
| 15 Oct 2026 | C | Boards are hashed (engagement id, fnv1a mod 8); clients are chosen (clients.color). Two systems on purpose | hash clients too | Decided, under standing authority, from the live database |
| 14 Oct 2026 | L | Reading state is beads on the rope: three acid beads on a 44x24 loop, 2600ms | orbit, scatter, pulse, spinner | Decided |
| 14 Oct 2026 | L | Context on a board is corona and spotlight together (acid outline, 30 percent dim) | one loop, corona only, spotlight only | Decided |
| 14 Oct 2026 | L | Keep the existing brand lockup; only colour moves to acid | loop replaces the O | Decided |
| 14 Oct 2026 | not recorded | Primary button in graphite grain with an acid offset shadow | flat ink, concrete, letterpress, cast, smudge, pale, paper | Superseded 15 Oct |
| 15 Oct 2026 | C via project knowledge rule 10 | Primary button is flat ink, --btn-shadow none, card shadow 15 percent | the 14 Oct graphite grain | Decided, confirmed by L |
| 15 Oct 2026 | L | The repo is the source of truth for every design value and decision; Magic OS is where design is decided and shown. Flow: OS proposes, repo records, OS mirrors | Magic OS as the single source of truth copied exactly | Decided |

Open: where the four --verify-* states render (chat answer, opened view, card); placement of Recent boards in the sidebar; whether the graphite grain button returns.
| 15 Oct 2026 | L | All work lane card takes the Bone and Acid furniture, keeps thumbnail and summary chain, no mirror | mirror face on the lane (rejected: test-pinned summary chain, lane is a scan surface) | Built, preview |
