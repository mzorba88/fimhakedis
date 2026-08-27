import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Türkçe/İngilizce karakter farkını yok sayan arama normalizasyonu.
 * "şantiye" -> "santiye", "OGUZ" -> "oguz" (ö/ø/ş/ç/ğ/ı/İ/ü hepsi ASCII karşılığına iner).
 */
export function foldTr(input: unknown): string {
  const s = String(input ?? '');
  return s
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .trim();
}

/** foldTr ile karakter duyarsız içerir kontrolü. */
export const matchesSearch = (haystack: unknown, query: string): boolean => {
  const q = foldTr(query);
  return !q || foldTr(haystack).includes(q);
};

/** Turkish-locale, numeric-aware natural comparator (e.g. "P2" < "P10"). */
export const naturalCompare = (a: string, b: string) =>
  (a ?? '').localeCompare(b ?? '', 'tr', { numeric: true, sensitivity: 'base' });

/** Return a new array sorted naturally by a string key selector. */
export function sortNatural<T>(items: T[], keyFn: (item: T) => string): T[] {
  return [...items].sort((a, b) => naturalCompare(keyFn(a), keyFn(b)));
}
