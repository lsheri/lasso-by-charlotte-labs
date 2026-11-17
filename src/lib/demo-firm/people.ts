import type { DemoPerson } from "./types";

/** Placeholder firm name; checked against real firms before the seed runs. */
export const DEMO_FIRM_NAME = "Kestrel Bay Advisory";

/** Every demo login lives on this domain, which can never reach a real inbox. */
export const DEMO_EMAIL_DOMAIN = "kestrelbay.test";

/** Invented people. Keys are stable; emails are derived from them. */
export const DEMO_PEOPLE: DemoPerson[] = [
  // Partners
  { key: "hollis", name: "Maren Hollis", role: "admin", title: "Partner", practice: "Health" },
  { key: "okafor", name: "Tobi Okafor", role: "admin", title: "Partner", practice: "Transactions" },
  { key: "lindqvist", name: "Signe Lindqvist", role: "lead", title: "Partner", practice: "Operating model and strategy ops" },
  { key: "ramaswamy", name: "Dev Ramaswamy", role: "lead", title: "Partner", practice: "Education and workforce" },
  // Principals
  { key: "castellano", name: "Lucia Castellano", role: "lead", title: "Principal", practice: "Growth and marketing" },
  { key: "abernathy", name: "June Abernathy", role: "lead", title: "Principal", practice: "Social impact" },
  { key: "nakamura", name: "Ren Nakamura", role: "em", title: "Principal", practice: "Health" },
  { key: "brennan", name: "Cormac Brennan", role: "em", title: "Principal", practice: "Transactions" },
  { key: "adeyemi", name: "Folake Adeyemi", role: "em", title: "Principal", practice: "Education and workforce" },
  { key: "voss", name: "Anika Voss", role: "em", title: "Principal", practice: "Operating model and strategy ops" },
  // Managers
  { key: "pereira", name: "Tiago Pereira", role: "em", title: "Manager", practice: "Health" },
  { key: "whitfield", name: "Grace Whitfield", role: "em", title: "Manager", practice: "Growth and marketing" },
  { key: "haddad", name: "Sami Haddad", role: "em", title: "Manager", practice: "Transactions" },
  { key: "mbeki", name: "Ayanda Mbeki", role: "em", title: "Manager", practice: "Social impact" },
  { key: "sorensen", name: "Erik Sorensen", role: "em", title: "Manager", practice: "Operating model and strategy ops" },
  { key: "delacroix", name: "Ines Delacroix", role: "em", title: "Manager", practice: "Education and workforce" },
  { key: "kowalski", name: "Piotr Kowalski", role: "em", title: "Manager", practice: "Growth and marketing" },
  { key: "tanaka", name: "Mei Tanaka", role: "em", title: "Manager", practice: "Health" },
  // Consultants and analysts
  { key: "obi", name: "Chidi Obi", role: "em", title: "Consultant", practice: "Transactions" },
  { key: "fairbanks", name: "Leah Fairbanks", role: "em", title: "Consultant", practice: "Health" },
  { key: "moreau", name: "Julien Moreau", role: "em", title: "Consultant", practice: "Operating model and strategy ops" },
  { key: "singh", name: "Priya Singh", role: "em", title: "Consultant", practice: "Education and workforce" },
  { key: "eriksen", name: "Nora Eriksen", role: "em", title: "Consultant", practice: "Growth and marketing" },
  { key: "galloway", name: "Owen Galloway", role: "em", title: "Consultant", practice: "Social impact" },
  { key: "reyes", name: "Camila Reyes", role: "em", title: "Consultant", practice: "Health" },
  { key: "park", name: "Daniel Park", role: "em", title: "Consultant", practice: "Transactions" },
  { key: "achebe", name: "Ngozi Achebe", role: "em", title: "Analyst", practice: "Operating model and strategy ops" },
  { key: "lund", name: "Felix Lund", role: "em", title: "Analyst", practice: "Growth and marketing" },
  { key: "costa", name: "Beatriz Costa", role: "em", title: "Analyst", practice: "Education and workforce" },
  { key: "hart", name: "Isaac Hart", role: "em", title: "Analyst", practice: "Transactions" },
  { key: "yilmaz", name: "Elif Yilmaz", role: "em", title: "Analyst", practice: "Health" },
  { key: "doyle", name: "Rosa Doyle", role: "em", title: "Analyst", practice: "Social impact" },
  // Operations
  { key: "quinn", name: "Harper Quinn", role: "em", title: "Operations", practice: "Firm" },
];

export function demoEmail(key: string): string {
  return `${key}@${DEMO_EMAIL_DOMAIN}`;
}
