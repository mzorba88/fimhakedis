import type { WorkEntry, SubcontractorHakedis, Currency } from '@/types/hakedis';

export interface ContractAccount {
  contractTotal: number;
  hakedisTotal: number;        // Tüm hakedişlerin toplamı (onaya bakılmaksızın)
  approvedTotal: number;       // Sadece onaylanmış hakedişler
  paidTotal: number;           // Gerçekten ödenen tutar
  remainingApproved: number;   // Onaylanan - Ödenen (ödenmeyi bekleyen)
  remainingContract: number;   // Sözleşme - Hakediş Toplamı (sözleşmeye kalan)
  currency: Currency;
  hakedisCount: number;
  isOverPaid: boolean;
}

/**
 * Bir sözleşmenin cari hesap özetini hesaplar.
 * Düzenleme modunda mevcut hakediş hariç tutulabilir.
 */
export function getContractAccount(
  contract: WorkEntry,
  allHakedisler: SubcontractorHakedis[],
  excludeHakedisId?: string
): ContractAccount {
  const related = allHakedisler.filter(
    (h) => h.contractId === contract.id && h.id !== excludeHakedisId
  );

  const hakedisTotal = related.reduce((s, h) => s + (h.totalAmount || 0), 0);
  const approvedTotal = related
    .filter((h) => h.approvalStatus === 'onaylandi')
    .reduce((s, h) => s + (h.totalAmount || 0), 0);

  const paidTotal = related.reduce((s, h) => {
    if (h.paymentStatus === 'odendi') return s + (h.totalAmount || 0);
    return s + (h.paidAmount || 0);
  }, 0);

  const contractTotal = contract.totalAmount || 0;

  return {
    contractTotal,
    hakedisTotal,
    approvedTotal,
    paidTotal,
    remainingApproved: approvedTotal - paidTotal,
    remainingContract: contractTotal - hakedisTotal,
    currency: contract.currency as Currency,
    hakedisCount: related.length,
    isOverPaid: hakedisTotal > contractTotal && contractTotal > 0,
  };
}

/**
 * Bir sözleşmedeki her iş kalemi (workItemEntryId) için
 * önceki hakedişlerde girilmiş kümülatif miktarı döndürür.
 */
export function getCumulativeWorkItemQuantities(
  contractId: string,
  allHakedisler: SubcontractorHakedis[],
  excludeHakedisId?: string
): Map<string, number> {
  const map = new Map<string, number>();
  allHakedisler
    .filter((h) => h.contractId === contractId && h.id !== excludeHakedisId)
    .forEach((h) => {
      (h.hakedisItems || []).forEach((item) => {
        const prev = map.get(item.workItemEntryId) || 0;
        map.set(item.workItemEntryId, prev + (item.quantity || 0));
      });
    });
  return map;
}

/**
 * Bir altyüklenicinin proje+para birimi bazında gruplanmış cari hesabını çıkarır.
 */
export interface SubcontractorProjectAccount {
  projectId: string;
  projectName: string;
  currency: Currency;
  contractCount: number;
  contractTotal: number;
  hakedisTotal: number;
  approvedTotal: number;
  paidTotal: number;
  remainingApproved: number;
  remainingContract: number;
  isOverPaid: boolean;
  /** KDV dahil karşılıkları */
  contractTotalIncl: number;
  hakedisTotalIncl: number;
  approvedTotalIncl: number;
  paidTotalIncl: number;
  remainingApprovedIncl: number;
  remainingContractIncl: number;
}

export function getSubcontractorProjectAccounts(
  subcontractor: string,
  contracts: WorkEntry[],
  hakedisler: SubcontractorHakedis[],
  projectName: (id?: string) => string
): SubcontractorProjectAccount[] {
  const map = new Map<string, SubcontractorProjectAccount>();
  const ensure = (projectId: string, currency: Currency) => {
    const key = `${projectId || 'none'}__${currency}`;
    if (!map.has(key)) {
      map.set(key, {
        projectId,
        projectName: projectName(projectId),
        currency,
        contractCount: 0,
        contractTotal: 0,
        hakedisTotal: 0,
        approvedTotal: 0,
        paidTotal: 0,
        remainingApproved: 0,
        remainingContract: 0,
        isOverPaid: false,
        contractTotalIncl: 0,
        hakedisTotalIncl: 0,
        approvedTotalIncl: 0,
        paidTotalIncl: 0,
        remainingApprovedIncl: 0,
        remainingContractIncl: 0,
      });
    }
    return map.get(key)!;
  };

  const withVat = (amount: number, vatRate?: number | null) =>
    amount * (1 + (vatRate && vatRate > 0 ? vatRate : 0) / 100);

  contracts
    .filter((c) => c.subcontractor === subcontractor)
    .forEach((c) => {
      const acc = ensure(c.projectId, c.currency as Currency);
      acc.contractCount += 1;
      acc.contractTotal += c.totalAmount || 0;
      acc.contractTotalIncl += withVat(c.totalAmount || 0, c.vatRate);
    });

  hakedisler
    .filter((h) => h.subcontractor === subcontractor)
    .forEach((h) => {
      const acc = ensure(h.projectId || '', h.currency as Currency);
      acc.hakedisTotal += h.totalAmount || 0;
      acc.hakedisTotalIncl += withVat(h.totalAmount || 0, h.vatRate);
      if (h.approvalStatus === 'onaylandi') {
        acc.approvedTotal += h.totalAmount || 0;
        acc.approvedTotalIncl += withVat(h.totalAmount || 0, h.vatRate);
      }
      const paid = h.paymentStatus === 'odendi' ? (h.totalAmount || 0) : (h.paidAmount || 0);
      acc.paidTotal += paid;
      acc.paidTotalIncl += withVat(paid, h.vatRate);
    });

  map.forEach((acc) => {
    acc.remainingApproved = acc.approvedTotal - acc.paidTotal;
    acc.remainingContract = acc.contractTotal - acc.hakedisTotal;
    acc.remainingApprovedIncl = acc.approvedTotalIncl - acc.paidTotalIncl;
    acc.remainingContractIncl = acc.contractTotalIncl - acc.hakedisTotalIncl;
    acc.isOverPaid = acc.contractTotal > 0 && acc.hakedisTotal > acc.contractTotal;
  });

  return Array.from(map.values()).sort((a, b) =>
    a.projectName.localeCompare(b.projectName, 'tr')
  );
}

/* =========================================================================
 * İŞ DOSYASI (CARİ HESAP DEFTERİ)
 * Altyüklenici + Proje + Para birimi bazında, sözleşmeli ve sözleşmesiz tüm
 * hakediş hareketlerini tek bir defterde toplar.
 * ========================================================================= */

export type LedgerEntryKind = 'contract' | 'hakedis';

export interface LedgerMovement {
  id: string;
  kind: LedgerEntryKind;
  date: string;
  no: string;
  /** ara_hakedis | alelhesap | kesin_hesap | sozlesme */
  type: string;
  typeLabel: string;
  description: string;
  contractId?: string;
  contractNo?: string;
  workCategory?: string;
  amount: number;       // KDV hariç
  amountIncl: number;   // KDV dahil
  paid: number;         // KDV hariç ödenen
  paidIncl: number;
  runningBalance: number;      // kümülatif (hakediş - ödenen), KDV hariç
  runningBalanceIncl: number;
  approvalStatus?: string;
  paymentStatus?: string;
  vatRate?: number;
  offsetAmount?: number;
}

export interface SubcontractorLedger {
  key: string;
  subcontractor: string;
  projectId: string;
  projectName: string;
  projectCode?: string;
  currency: Currency;
  hasProject: boolean;

  contracts: WorkEntry[];
  contractTotal: number;
  contractTotalIncl: number;

  araTotal: number;
  alelhesapTotal: number;
  kesinHesapTotal: number;

  hakedisTotal: number;
  hakedisTotalIncl: number;
  approvedTotal: number;
  approvedTotalIncl: number;
  paidTotal: number;
  paidTotalIncl: number;

  remainingApproved: number;      // onaylı ama ödenmemiş
  remainingApprovedIncl: number;
  remainingContract: number;      // sözleşme - hakediş
  remainingContractIncl: number;

  hasKesinHesap: boolean;
  isOverPaid: boolean;
  movements: LedgerMovement[];
}

const vatFactor = (vatRate?: number | null) =>
  1 + (vatRate && vatRate > 0 ? vatRate : 0) / 100;

const paidOf = (h: SubcontractorHakedis) =>
  h.paymentStatus === 'odendi' ? (h.totalAmount || 0) : (h.paidAmount || 0);

const typeLabels: Record<string, string> = {
  ara_hakedis: 'Ara Hakediş',
  alelhesap: 'Alelhesap',
  kesin_hesap: 'Kesin Hesap',
};

/**
 * Bir altyüklenicinin tüm iş dosyalarını (proje + para birimi) çıkarır.
 * Sözleşmesiz (küçük iş) hakedişler de projeye göre aynı dosyada toplanır;
 * projesiz kayıtlar "Proje belirtilmemiş" dosyasında gruplanır.
 */
export function getSubcontractorLedgers(
  subcontractor: string,
  contracts: WorkEntry[],
  hakedisler: SubcontractorHakedis[],
  projectInfo: (id?: string) => { name: string; code?: string }
): SubcontractorLedger[] {
  const map = new Map<string, SubcontractorLedger>();

  const ensure = (projectId: string, currency: Currency): SubcontractorLedger => {
    const key = `${projectId || 'none'}__${currency}`;
    if (!map.has(key)) {
      const info = projectInfo(projectId);
      map.set(key, {
        key,
        subcontractor,
        projectId,
        projectName: info.name,
        projectCode: info.code,
        currency,
        hasProject: Boolean(projectId),
        contracts: [],
        contractTotal: 0,
        contractTotalIncl: 0,
        araTotal: 0,
        alelhesapTotal: 0,
        kesinHesapTotal: 0,
        hakedisTotal: 0,
        hakedisTotalIncl: 0,
        approvedTotal: 0,
        approvedTotalIncl: 0,
        paidTotal: 0,
        paidTotalIncl: 0,
        remainingApproved: 0,
        remainingApprovedIncl: 0,
        remainingContract: 0,
        remainingContractIncl: 0,
        hasKesinHesap: false,
        isOverPaid: false,
        movements: [],
      });
    }
    return map.get(key)!;
  };

  contracts
    .filter((c) => c.subcontractor === subcontractor)
    .forEach((c) => {
      const led = ensure(c.projectId, c.currency as Currency);
      led.contracts.push(c);
      led.contractTotal += c.totalAmount || 0;
      led.contractTotalIncl += (c.totalAmount || 0) * vatFactor(c.vatRate);
    });

  hakedisler
    .filter((h) => h.subcontractor === subcontractor)
    .forEach((h) => {
      const led = ensure(h.projectId || '', h.currency as Currency);
      const amount = h.totalAmount || 0;
      const amountIncl = amount * vatFactor(h.vatRate);
      const paid = paidOf(h);
      const paidIncl = paid * vatFactor(h.vatRate);
      const contract = contracts.find((c) => c.id === h.contractId);

      led.hakedisTotal += amount;
      led.hakedisTotalIncl += amountIncl;
      if (h.approvalStatus === 'onaylandi') {
        led.approvedTotal += amount;
        led.approvedTotalIncl += amountIncl;
      }
      led.paidTotal += paid;
      led.paidTotalIncl += paidIncl;

      if (h.hakedisType === 'alelhesap') led.alelhesapTotal += amount;
      else if (h.hakedisType === 'kesin_hesap') {
        led.kesinHesapTotal += amount;
        led.hasKesinHesap = true;
      } else led.araTotal += amount;

      led.movements.push({
        id: h.id,
        kind: 'hakedis',
        date: h.date,
        no: h.hakedisNo,
        type: h.hakedisType || 'ara_hakedis',
        typeLabel: typeLabels[h.hakedisType || 'ara_hakedis'] || 'Hakediş',
        description: h.description || '',
        contractId: h.contractId || undefined,
        contractNo: h.contractNo || undefined,
        workCategory: contract?.workCategory,
        amount,
        amountIncl,
        paid,
        paidIncl,
        runningBalance: 0,
        runningBalanceIncl: 0,
        approvalStatus: h.approvalStatus,
        paymentStatus: h.paymentStatus,
        vatRate: h.vatRate ?? undefined,
        offsetAmount: h.offsetAmount ?? undefined,
      });
    });

  map.forEach((led) => {
    led.remainingApproved = led.approvedTotal - led.paidTotal;
    led.remainingApprovedIncl = led.approvedTotalIncl - led.paidTotalIncl;
    led.remainingContract = led.contractTotal - led.hakedisTotal;
    led.remainingContractIncl = led.contractTotalIncl - led.hakedisTotalIncl;
    led.isOverPaid = led.contractTotal > 0 && led.hakedisTotal > led.contractTotal;

    led.movements.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    let bal = 0;
    let balIncl = 0;
    led.movements.forEach((m) => {
      bal += m.amount - m.paid;
      balIncl += m.amountIncl - m.paidIncl;
      m.runningBalance = bal;
      m.runningBalanceIncl = balIncl;
    });
    led.movements.reverse();
  });

  return Array.from(map.values()).sort(
    (a, b) =>
      (a.projectCode || 'zzz').localeCompare(b.projectCode || 'zzz', 'tr') ||
      a.projectName.localeCompare(b.projectName, 'tr')
  );
}

/**
 * Kesin hesap mahsup hesabı: toplam üretimden, aynı dosyadaki (sözleşme varsa
 * sözleşme bazlı, yoksa proje bazlı) önceki ara hakediş ve alelhesapları düşer.
 */
export interface FinalSettlement {
  production: number;      // girilen toplam üretim (KDV hariç)
  previousAra: number;
  previousAlelhesap: number;
  totalPrevious: number;
  netPayable: number;      // production - totalPrevious
}

export function computeFinalSettlement(params: {
  production: number;
  subcontractor: string;
  projectId?: string;
  contractId?: string;
  currency: Currency;
  hakedisler: SubcontractorHakedis[];
  excludeHakedisId?: string;
}): FinalSettlement {
  const {
    production,
    subcontractor,
    projectId,
    contractId,
    currency,
    hakedisler,
    excludeHakedisId,
  } = params;

  const related = hakedisler.filter((h) => {
    if (h.id === excludeHakedisId) return false;
    if (h.subcontractor !== subcontractor) return false;
    if (h.currency !== currency) return false;
    if (h.hakedisType === 'kesin_hesap') return false;
    if (contractId) return h.contractId === contractId;
    return (h.projectId || '') === (projectId || '');
  });

  const previousAra = related
    .filter((h) => (h.hakedisType || 'ara_hakedis') === 'ara_hakedis')
    .reduce((s, h) => s + (h.totalAmount || 0), 0);
  const previousAlelhesap = related
    .filter((h) => h.hakedisType === 'alelhesap')
    .reduce((s, h) => s + (h.totalAmount || 0), 0);

  const totalPrevious = previousAra + previousAlelhesap;
  return {
    production,
    previousAra,
    previousAlelhesap,
    totalPrevious,
    netPayable: production - totalPrevious,
  };
}

/**
 * Aynı altyüklenici/proje/sözleşme için yakın tarihli ve aynı tutarlı kayıt var mı?
 */
export function findPossibleDuplicates(params: {
  subcontractor: string;
  projectId?: string;
  contractId?: string;
  currency: Currency;
  amount: number;
  date: string;
  hakedisler: SubcontractorHakedis[];
  excludeHakedisId?: string;
  dayWindow?: number;
}): SubcontractorHakedis[] {
  const {
    subcontractor,
    projectId,
    contractId,
    currency,
    amount,
    date,
    hakedisler,
    excludeHakedisId,
    dayWindow = 30,
  } = params;
  if (!amount || amount <= 0) return [];
  const target = new Date(date).getTime();
  const tol = Math.max(1, amount * 0.005);

  return hakedisler.filter((h) => {
    if (h.id === excludeHakedisId) return false;
    if (h.subcontractor !== subcontractor) return false;
    if (h.currency !== currency) return false;
    if (contractId ? h.contractId !== contractId : (h.projectId || '') !== (projectId || ''))
      return false;
    if (Math.abs((h.totalAmount || 0) - amount) > tol) return false;
    const d = new Date(h.date).getTime();
    if (Number.isNaN(d) || Number.isNaN(target)) return false;
    return Math.abs(d - target) <= dayWindow * 86400000;
  });
}
