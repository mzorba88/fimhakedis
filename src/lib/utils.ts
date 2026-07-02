import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Turkish-locale, numeric-aware natural comparator (e.g. "P2" < "P10"). */
export const naturalCompare = (a: string, b: string) =>
  (a ?? '').localeCompare(b ?? '', 'tr', { numeric: true, sensitivity: 'base' });

/** Return a new array sorted naturally by a string key selector. */
export function sortNatural<T>(items: T[], keyFn: (item: T) => string): T[] {
  return [...items].sort((a, b) => naturalCompare(keyFn(a), keyFn(b)));
}
