# Motion scenes

`src/lib/motion-scenes.ts` is the source of truth. This table is the readable copy.

`src/lib/motion-registry.ts` is a separate thing: the event-to-motion map that `useMotion` reads. It is not this table.

| id | name | source | duration | loop | pause | role | where it renders |
| --- | --- | --- | ---: | --- | ---: | --- | --- |
| `m6-spider-lasso` | Spider, lassoing conversations | Sandbox A · M6 · Spider guide beats · 2026:1103 | 4200 ms | loop-with-pause | 10000 ms | background | `src/pages/WorkPage.tsx` — Inbox, behind the page |
| `m10-notebook-spider` | Spider, reading your work | Sandbox A · M10 · Spider processes | 3000 ms | loop | none | inline | `src/components/provenance/ProvenanceAudit.tsx` — provenance audit loading state |