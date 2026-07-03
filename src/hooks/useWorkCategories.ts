import { useCallback, useEffect, useState } from 'react';
import { workCategories as builtInCategories } from '@/types/hakedis';
import { sortNatural } from '@/lib/utils';

const STORAGE_KEY = 'customWorkCategories';

const readCustom = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
};

export function useWorkCategories() {
  const [custom, setCustom] = useState<string[]>(() => readCustom());

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setCustom(readCustom());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const addCategory = useCallback((name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const all = [...builtInCategories, ...readCustom()];
    const exists = all.some((c) => c.toLocaleLowerCase('tr') === trimmed.toLocaleLowerCase('tr'));
    if (exists) {
      const match = all.find((c) => c.toLocaleLowerCase('tr') === trimmed.toLocaleLowerCase('tr'));
      return match ?? trimmed;
    }
    const next = [...readCustom(), trimmed];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setCustom(next);
    return trimmed;
  }, []);

  const categories = sortNatural([...new Set([...builtInCategories, ...custom])], (c) => c);

  return { categories, addCategory };
}
