import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { ADDING_PEOPLE, type AddingPeopleSection } from "@/lib/adding-people";

function ContentTable({ table }: { table: NonNullable<AddingPeopleSection["table"]> }) {
  return (
    <div className="my-5 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--nb-pencil)]">
            {table.head.map((heading) => (
              <th key={heading} scope="col" className="px-3 py-2 font-medium first:pl-0 last:pr-0">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.join("|")} className="border-b border-[var(--nb-hairline)] align-top">
              {row.map((cell, index) => (
                <td key={`${index}:${cell}`} className="px-3 py-3 leading-relaxed text-muted-foreground first:pl-0 last:pr-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AddingPeoplePage() {
  return (
    <div className="max-w-4xl">
      <PageHeader title={ADDING_PEOPLE.title} subtitle={ADDING_PEOPLE.intro} />
      <div className="space-y-10">
        {ADDING_PEOPLE.sections.map((section) => (
          <section key={section.id} className="border-t border-[var(--nb-pencil)] pt-8">
            <SectionHeader title={section.title} />
            <div className="space-y-3">
              {section.body.map((line) => (
                <p key={line} className="text-sm leading-relaxed text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
            {section.table ? <ContentTable table={section.table} /> : null}
            {section.bullets ? (
              <ul className="ml-5 mt-4 list-disc space-y-2 text-sm leading-relaxed text-muted-foreground">
                {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
