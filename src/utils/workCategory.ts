import { SubcontractorHakedis, WorkEntry } from '@/types/hakedis';

/**
 * Bir hakediş için iş kalemi kategorisini çözer.
 * Öncelik: sözleşme kategorisi -> kalemlerdeki kategori -> açıklamadaki [Etiket] -> altyüklenici kategorisi
 */
export const resolveHakedisCategory = (
  hakedis: Partial<SubcontractorHakedis> | undefined | null,
  contract?: Partial<WorkEntry> | null,
  subcontractors?: { name: string; workCategory: string }[]
): string => {
  if (!hakedis) return '';
  if (contract?.workCategory) return contract.workCategory;

  const itemCat =
    hakedis.hakedisItems?.find((i: any) => i?.workCategory)?.workCategory ||
    (hakedis as any).extraItems?.find((i: any) => i?.workCategory)?.workCategory;
  if (itemCat) return itemCat;

  const tag = (hakedis.description || '').match(/\[([^\]]+)\]/);
  if (tag && !/^\s*proje\s*:/i.test(tag[1])) return tag[1].trim();

  const sub = subcontractors?.find((s) => s.name === hakedis.subcontractor);
  return sub?.workCategory || '';
};
