/**
 * Proje Maliyet Yönetimi (Aşama 2) — salt okunur toplulaştırma.
 * Finansal sonuçlar hakedisCalculations (summarizeFiles / analyzeHakedis) üzerinden gelir;
 * burada yalnızca proje, altyüklenici ve iş kalemi bazında gruplanır.
 * Para birimleri asla birleştirilmez. Tüm tutarlar KDV hariç saklanır; KDV dahil
 * değerler her kaydın kendi oranıyla hesaplanır (oran yoksa KDV eklenmez).
 */
import type { Currency, SubcontractorHakedis, WorkEntry } from '@/types/hakedis';
import { analyzeHakedis, summarizeFiles, type FileSummary, type HakedisBreakdown } from '@/utils/hakedisCalculations';

export const UNCLASSIFIED = 'Sınıflandırılmamış';

export interface Money { excl: number; incl: number }
const m0 = (): Money => ({ excl: 0, incl: 0 });
const vf = (r?: number | null) => 1 + (r && r > 0 ? r : 0) / 100;
const add = (a: Money, excl: number, rate?: number | null) => { a.excl += excl; a.incl += excl * vf(rate); };

export interface CurrencyTotalsRow {
  currency: Currency;
  contract: Money;
  approved: Money;
  paid: Money;
  remaining: Money;
  remainingContract: Money;
  pending: number;
  /** Yalnızca güvenilir dosyalardan */
  verified: { approved: Money; paid: Money; remaining: Money };
  unreliableFileCount: number;
  fullyReliable: boolean;
}

export interface SubcontractorRow {
  key: string;
  subcontractor: string;
  category: string;
  currency: Currency;
  file: FileSummary;
  contract: Money;
  approved: Money;
  paid: Money;
  remaining: Money;
  remainingContract: Money;
  contracts: WorkEntry[];
  hakedisler: SubcontractorHakedis[];
  reliable: boolean;
  unresolvedAlelhesap: SubcontractorHakedis[];
  categories: { category: string; approved: number }[];
}

export interface CategoryRow {
  key: string;
  category: string;
  currency: Currency;
  committed: Money;
  approved: Money;
  paid: Money;
  subcontractors: string[];
  hakedisIds: string[];
  /** Bütçe tablosu henüz yok — null = "Bütçe tanımlanmadı" */
  budget: Money | null;
}

export interface HakedisRow {
  hakedis: SubcontractorHakedis;
  breakdown: HakedisBreakdown;
  categoryLabel: string;
  isContractless: boolean;
  /** Dönem tutarı (KDV hariç); belirsizse null */
  period: number | null;
}

export interface ProjectCost {
  currencies: CurrencyTotalsRow[];
  subcontractors: SubcontractorRow[];
  categories: CategoryRow[];
  hakedisler: HakedisRow[];
  unresolved: { hakedis: SubcontractorHakedis; reasons: string[] }[];
  unverifiedAlelhesap: SubcontractorHakedis[];
  recordsWithoutVatRate: number;
}

/** Bir hakedişin dönem tutarını kalemlere göre kategorilere dağıtır. */
export function allocateCategories(
  h: SubcontractorHakedis,
  period: number,
  contract?: WorkEntry
): { category: string; amount: number }[] {
  const cumulative = h.hakedisType === 'kesin_hesap' &&
    [...(h.hakedisItems || []), ...(h.extraItems || [])].some(i => i.settlementSnapshot === 'cumulative_v4b');
  const items = [...(h.hakedisItems || []), ...(h.extraItems || [])]
    .map((i) => ({ cat: (i?.workCategory || '').trim(), amount: cumulative
      ? (Number(i.settlementPeriodAmount) || 0)
      : (Number(i.amount) || (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0)) }))
    .filter((i) => i.amount > 0);
  const itemSum = items.reduce((s, i) => s + i.amount, 0);
  if (items.length && itemSum > 0) {
    const map = new Map<string, number>();
    items.forEach((i) => {
      // Satır kategorisi öncelikli; yoksa sözleşme kategorisi (varsa), o da yoksa sınıflandırılmamış
      const cat = i.cat || contract?.workCategory || UNCLASSIFIED;
      map.set(cat, (map.get(cat) || 0) + (period * i.amount) / itemSum);
    });
    return Array.from(map, ([category, amount]) => ({ category, amount }));
  }
  if (contract?.workCategory) return [{ category: contract.workCategory, amount: period }];
  const tag = (h.description || '').match(/\[([^\]]+)\]/);
  if (tag && !/^\s*proje\s*:/i.test(tag[1])) return [{ category: tag[1].trim(), amount: period }];
  return [{ category: UNCLASSIFIED, amount: period }];
}

export function buildProjectCost(
  projectId: string,
  allHakedisler: SubcontractorHakedis[],
  allContracts: WorkEntry[],
  subcontractorCats: { name: string; workCategory: string }[] = []
): ProjectCost {
  const hk = allHakedisler.filter((h) => (h.projectId || '') === projectId);
  const cs = allContracts.filter((c) => c.projectId === projectId);
  // Kesin hesap analizi aynı dosyadaki tüm kayıtlara ihtiyaç duyar → tüm liste ile analiz
  const files = summarizeFiles(hk, cs);
  const contractById = new Map(allContracts.map((c) => [c.id, c]));

  const breakdowns = new Map<string, HakedisBreakdown>();
  hk.forEach((h) => breakdowns.set(h.id, analyzeHakedis(h, hk)));

  // Kesin hesapla eşleşmemiş alelhesaplar: dosyasında kesin hesap yok → nitelik doğrulanmadı
  const unverifiedAlelhesap = hk.filter(
    (h) =>
      h.hakedisType === 'alelhesap' &&
      !hk.some(
        (k) =>
          k.hakedisType === 'kesin_hesap' && k.subcontractor === h.subcontractor && k.currency === h.currency &&
          (h.contractId ? k.contractId === h.contractId : !k.contractId)
      )
  );

  const curMap = new Map<Currency, CurrencyTotalsRow>();
  const ensureCur = (c: Currency) => {
    if (!curMap.has(c))
      curMap.set(c, {
        currency: c, contract: m0(), approved: m0(), paid: m0(), remaining: m0(), remainingContract: m0(), pending: 0,
        verified: { approved: m0(), paid: m0(), remaining: m0() }, unreliableFileCount: 0, fullyReliable: true,
      });
    return curMap.get(c)!;
  };

  const subRows: SubcontractorRow[] = files.map((f) => {
    const recs = hk.filter((h) => h.subcontractor === f.subcontractor && h.currency === f.currency);
    const contracts = cs.filter((c) => c.subcontractor === f.subcontractor && c.currency === f.currency);
    const catMap = new Map<string, number>();
    recs.forEach((h) => {
      const b = breakdowns.get(h.id)!;
      if (!b.isApproved || b.periodAmount === null) return;
      allocateCategories(h, b.periodAmount, contractById.get(h.contractId)).forEach(({ category, amount }) =>
        catMap.set(category, (catMap.get(category) || 0) + amount)
      );
    });
    const ratio = (excl: number, incl: number) => ({ excl, incl });
    const contractRatio = f.contractTotal > 0 ? f.vat.contractTotal / f.contractTotal : 1;
    const row: SubcontractorRow = {
      key: `${f.subcontractor}__${f.currency}`,
      subcontractor: f.subcontractor,
      category:
        contracts[0]?.workCategory ||
        Array.from(catMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        subcontractorCats.find((s) => s.name === f.subcontractor)?.workCategory ||
        '',
      currency: f.currency,
      file: f,
      contract: ratio(f.contractTotal, f.vat.contractTotal),
      approved: ratio(f.approvedAccrual, f.vat.approvedAccrual),
      paid: ratio(f.recordedPayment, f.vat.recordedPayment),
      remaining: ratio(f.remainingPayment, f.vat.remainingPayment),
      remainingContract: ratio(f.remainingContract, f.contractTotal > 0 ? f.remainingContract * contractRatio : 0),
      contracts,
      hakedisler: recs.sort((a, b) => (b.date || '').localeCompare(a.date || '')),
      reliable: f.reliable,
      unresolvedAlelhesap: unverifiedAlelhesap.filter((a) => a.subcontractor === f.subcontractor && a.currency === f.currency),
      categories: Array.from(catMap, ([category, approved]) => ({ category, approved })).sort((a, b) => b.approved - a.approved),
    };

    const t = ensureCur(f.currency);
    const plus = (a: Money, b: Money) => { a.excl += b.excl; a.incl += b.incl; };
    plus(t.contract, row.contract);
    plus(t.approved, row.approved);
    plus(t.paid, row.paid);
    plus(t.remaining, row.remaining);
    plus(t.remainingContract, row.remainingContract);
    t.pending += f.pendingAmount;
    if (f.reliable) {
      plus(t.verified.approved, row.approved);
      plus(t.verified.paid, row.paid);
      plus(t.verified.remaining, row.remaining);
    } else {
      t.unreliableFileCount += 1;
      t.fullyReliable = false;
    }
    return row;
  });

  // İş kalemleri
  const catRows = new Map<string, CategoryRow>();
  const ensureCat = (category: string, currency: Currency) => {
    const key = `${category}__${currency}`;
    if (!catRows.has(key))
      catRows.set(key, { key, category, currency, committed: m0(), approved: m0(), paid: m0(), subcontractors: [], hakedisIds: [], budget: null });
    return catRows.get(key)!;
  };
  const addSub = (r: CategoryRow, s: string) => { if (!r.subcontractors.includes(s)) r.subcontractors.push(s); };

  cs.forEach((c) => {
    const entries = (c.workItemEntries || []).filter((w) => (w.quantity || 0) * (w.unitPrice || 0) > 0);
    const entrySum = entries.reduce((s, w) => s + w.quantity * w.unitPrice, 0);
    if (entries.length && entrySum > 0) {
      entries.forEach((w) => {
        const r = ensureCat(w.workCategory || c.workCategory || UNCLASSIFIED, c.currency);
        add(r.committed, ((c.totalAmount || 0) * w.quantity * w.unitPrice) / entrySum, c.vatRate);
        addSub(r, c.subcontractor);
      });
    } else {
      const r = ensureCat(c.workCategory || UNCLASSIFIED, c.currency);
      add(r.committed, c.totalAmount || 0, c.vatRate);
      addSub(r, c.subcontractor);
    }
  });

  hk.forEach((h) => {
    const b = breakdowns.get(h.id)!;
    if (!b.isApproved || b.periodAmount === null) return;
    const alloc = allocateCategories(h, b.periodAmount, contractById.get(h.contractId));
    const total = alloc.reduce((s, a) => s + a.amount, 0) || 1;
    alloc.forEach(({ category, amount }) => {
      const r = ensureCat(category, h.currency);
      add(r.approved, amount, h.vatRate);
      add(r.paid, (b.recordedPayment * amount) / total, h.vatRate);
      addSub(r, h.subcontractor);
      if (!r.hakedisIds.includes(h.id)) r.hakedisIds.push(h.id);
    });
  });

  const hakedisRows: HakedisRow[] = hk
    .map((h) => {
      const b = breakdowns.get(h.id)!;
      const alloc = allocateCategories(h, 1, contractById.get(h.contractId));
      return {
        hakedis: h,
        breakdown: b,
        categoryLabel: alloc.length > 1 ? `${alloc.length} iş kalemi` : alloc[0].category,
        isContractless: !h.contractId,
        period: b.periodAmount,
      };
    })
    .sort((a, b) => (b.hakedis.date || '').localeCompare(a.hakedis.date || ''));

  const unresolved = hk
    .map((h) => ({ hakedis: h, b: breakdowns.get(h.id)! }))
    .filter(({ b }) => b.basis === 'belirsiz' || b.reasons.length > 0)
    .map(({ hakedis, b }) => ({ hakedis, reasons: b.reasons.length ? b.reasons : ['Giriş esası belirsiz'] }));

  const order: Currency[] = ['TRY', 'GBP', 'EUR', 'USD'];
  return {
    currencies: Array.from(curMap.values()).sort((a, b) => order.indexOf(a.currency) - order.indexOf(b.currency)),
    subcontractors: subRows,
    categories: Array.from(catRows.values()).sort((a, b) => a.category.localeCompare(b.category, 'tr')),
    hakedisler: hakedisRows,
    unresolved,
    unverifiedAlelhesap,
    recordsWithoutVatRate: [...hk, ...cs].filter((x) => x.vatRate == null).length,
  };
}
