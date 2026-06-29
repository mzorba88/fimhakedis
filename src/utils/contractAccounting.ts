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
      });
    }
    return map.get(key)!;
  };

  contracts
    .filter((c) => c.subcontractor === subcontractor)
    .forEach((c) => {
      const acc = ensure(c.projectId, c.currency as Currency);
      acc.contractCount += 1;
      acc.contractTotal += c.totalAmount || 0;
    });

  hakedisler
    .filter((h) => h.subcontractor === subcontractor)
    .forEach((h) => {
      const acc = ensure(h.projectId || '', h.currency as Currency);
      acc.hakedisTotal += h.totalAmount || 0;
      if (h.approvalStatus === 'onaylandi') {
        acc.approvedTotal += h.totalAmount || 0;
      }
      if (h.paymentStatus === 'odendi') {
        acc.paidTotal += h.totalAmount || 0;
      } else {
        acc.paidTotal += h.paidAmount || 0;
      }
    });

  map.forEach((acc) => {
    acc.remainingApproved = acc.approvedTotal - acc.paidTotal;
    acc.remainingContract = acc.contractTotal - acc.hakedisTotal;
    acc.isOverPaid = acc.contractTotal > 0 && acc.hakedisTotal > acc.contractTotal;
  });

  return Array.from(map.values()).sort((a, b) =>
    a.projectName.localeCompare(b.projectName, 'tr')
  );
}
