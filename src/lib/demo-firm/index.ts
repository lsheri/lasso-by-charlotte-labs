import { DEMO_FIRM_NAME, DEMO_PEOPLE } from "./people";
import type { DemoBoard, DemoFirm } from "./types";

/** Every board file in ./boards exports exactly one DemoBoard; they are collected here in key order (b1 to b30). */
const modules = import.meta.glob<Record<string, unknown>>("./boards/*.ts", { eager: true });

function isBoard(value: unknown): value is DemoBoard {
  return Boolean(value) && typeof value === "object" && typeof (value as DemoBoard).key === "string" && Array.isArray((value as DemoBoard).items);
}

export const DEMO_BOARDS: DemoBoard[] = Object.values(modules)
  .flatMap((module) => Object.values(module).filter(isBoard))
  .sort((a, b) => Number(a.key.slice(1)) - Number(b.key.slice(1)));

export const DEMO_FIRM: DemoFirm = { name: DEMO_FIRM_NAME, people: DEMO_PEOPLE, boards: DEMO_BOARDS };
