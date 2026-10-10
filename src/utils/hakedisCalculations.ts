/**
 * Merkezi hakediş hesaplama altyapısı (Aşama 1A).
 *
 * NOT: Bu modül henüz hiçbir ekranda kullanılmıyor. Mevcut ekranlar
 * contractAccounting.ts'deki eski fonksiyonları kullanmaya devam eder.
 * Eski/yeni sonuçlar hakedisCalculations.test.ts'de karşılaştırılır.
 *
 * Kavramlar (hepsi KDV hariç, tek para birimi içinde):
 *  - Kümülatif üretim   : işin başından bu yana yapılan toplam imalat
 *  - Dönem hakedişi     : bu kaydın tek başına getirdiği yeni tahakkuk
 *  - Onaylı tahakkuk    : onaylanmış kayıtların dönem hakedişleri toplamı
 *  - Kayıtlı ödeme      : sistemde ödeme olarak kayıtlı tutar (banka teyidi değildir)
 *  - Kalan ödeme bakiyesi: onaylı tahakkuk − kayıtlı ödeme
 *  - Sözleşmeye kalan iş: sözleşme tutarı − kümülatif üretim
 */
import type { Currency, SubcontractorHakedis, WorkEntry } from '@/types/hakedis';

export type InputBasis =
  | 'donem'        // ara hakediş / alelhesap: tutar zaten dönem tutarı
  | 'tek_seferlik' // kesin hesap, önceki kayıt yok, mahsup yok
  | 'kumulatif'    // kesin hesap, mahsup önceki kayıtlarla tutarlı
  | 'belirsiz';    // giriş esası tespit edilemedi → manuel inceleme

export interface HakedisBreakdown {
  id: string;
  hakedisNo: string;
  basis: InputBasis;
  /** Kümülatif üretim (yalnızca kesin hesaplarda anlamlı) */
  cumulativeProduction: number | null;
  /** Bu kaydın yeni tahakkuku; belirsizse null (otomatik üretilmez) */
  periodAmount: number | null;
  isApproved: boolean;
  /** Onay bekleyen / revize: kesinleşmiş borç değildir */
  isPendingOrRevise: boolean;
  /** Kayıtlı ödeme (paid_amount alanı veya 'odendi' durumu) */
  recordedPayment: number;
  /** paid_amount alanında yazan ham değer — değiştirilmeden korunur */
  rawPaidAmount: number;
  reasons: string[];
}

export interface CalcOptions {
  /** Kullanıcının manuel teyit ettiği giriş esasları (id → esas) */
  basisOverrides?: Record<string, InputBasis>;
  tolerance?: number;
}

const tolFor = (amount: number, tol?: number) => tol ?? Math.max(1, Math.abs(amount) * 0.005);

/** Aynı dosyadaki (sözleşme varsa sözleşme, yoksa proje) diğer kayıtlar */
function sameFile(h: SubcontractorHakedis, all: SubcontractorHakedis[]) {
  return all.filter(
    (o) =>
      o.id !== h.id &&
      o.subcontractor === h.subcontractor &&
      o.currency === h.currency &&
      (h.contractId
        ? o.contractId === h.contractId
        : !o.contractId && (o.projectId || '') === (h.projectId || ''))
  );
}

function recordedPaymentOf(h: SubcontractorHakedis, periodAmount: number | null): number {
  const raw = h.paidAmount || 0;
  if (raw > 0) return raw;
  if (h.paymentStatus === 'odendi') return periodAmount ?? 0;
  return 0;
}

export function analyzeHakedis(
  h: SubcontractorHakedis,
  all: SubcontractorHakedis[],
  opts: CalcOptions = {}
): HakedisBreakdown {
  const total = h.totalAmount || 0;
  const offset = h.offsetAmount || 0;
  const reasons: string[] = [];
  let basis: InputBasis;
  let periodAmount: number | null;
  let cumulativeProduction: number | null = null;

  const override = opts.basisOverrides?.[h.id];

  if (h.hakedisType !== 'kesin_hesap') {
    basis = override ?? 'donem';
  } else if (override) {
    basis = override;
    reasons.push('Giriş esası manuel olarak teyit edildi');
  } else {
    const prev = sameFile(h, all).filter((o) => o.hakedisType !== 'kesin_hesap');
    const before = prev.filter((o) => (o.date || '') <= (h.date || ''));
    const after = prev.filter((o) => (o.date || '') > (h.date || ''));
    const prevSum = before.reduce((s, o) => s + (o.totalAmount || 0), 0);

    if (after.length > 0) {
      basis = 'belirsiz';
      reasons.push(`Kesin hesaptan sonra ${after.length} adet ara/alelhesap kaydı var`);
    } else if (before.length === 0 && offset === 0) {
      basis = 'tek_seferlik';
    } else if (before.length === 0 && offset > 0) {
      basis = 'belirsiz';
      reasons.push('Önceki kayıt yokken mahsup girilmiş');
    } else if (offset === 0) {
      basis = 'belirsiz';
      reasons.push('Önceki kayıtlar var ama mahsup 0 — tutar dönem mi kümülatif mi belli değil');
    } else if (Math.abs(offset - prevSum) <= tolFor(prevSum, opts.tolerance)) {
      basis = 'kumulatif';
    } else {
      basis = 'belirsiz';
      reasons.push('Mahsup tutarı önceki kayıtların toplamıyla uyuşmuyor');
    }
    if (total - offset < 0) {
      basis = 'belirsiz';
      reasons.push('Net tutar negatif');
    }
  }

  switch (basis) {
    case 'donem':
      periodAmount = total;
      break;
    case 'tek_seferlik':
      periodAmount = total;
      cumulativeProduction = total;
      break;
    case 'kumulatif':
      periodAmount = total - offset;
      cumulativeProduction = total;
      break;
    default:
      periodAmount = null;
  }

  const recordedPayment = recordedPaymentOf(h, periodAmount);
  if (periodAmount !== null && recordedPayment > periodAmount + tolFor(periodAmount, opts.tolerance)) {
    reasons.push('Kayıtlı ödeme dönem hakedişinden büyük');
  }

  return {
    id: h.id,
    hakedisNo: h.hakedisNo,
    basis,
    cumulativeProduction,
    periodAmount,
    isApproved: h.approvalStatus === 'onaylandi',
    isPendingOrRevise: h.approvalStatus === 'onay_bekliyor' || h.approvalStatus === 'revize',
    recordedPayment,
    rawPaidAmount: h.paidAmount || 0,
    reasons,
  };
}

export interface FileSummary {
  subcontractor: string;
  projectId: string;
  currency: Currency;
  contractTotal: number;
  cumulativeProduction: number;
  approvedAccrual: number;
  pendingAmount: number;
  recordedPayment: number;
  remainingPayment: number;
  remainingContract: number;
  unresolved: HakedisBreakdown[];
  items: HakedisBreakdown[];
}

/** Altyüklenici + proje + para birimi dosyası özeti. Para birimleri asla karışmaz. */
export function summarizeFiles(
  hakedisler: SubcontractorHakedis[],
  contracts: WorkEntry[],
  opts: CalcOptions = {}
): FileSummary[] {
  const map = new Map<string, FileSummary>();
  const ensure = (sub: string, projectId: string, currency: Currency) => {
    const key = `${sub}__${projectId || 'none'}__${currency}`;
    if (!map.has(key))
      map.set(key, {
        subcontractor: sub, projectId, currency,
        contractTotal: 0, cumulativeProduction: 0, approvedAccrual: 0, pendingAmount: 0,
        recordedPayment: 0, remainingPayment: 0, remainingContract: 0, unresolved: [], items: [],
      });
    return map.get(key)!;
  };

  contracts.forEach((c) => {
    ensure(c.subcontractor, c.projectId, c.currency).contractTotal += c.totalAmount || 0;
  });

  hakedisler.forEach((h) => {
    const f = ensure(h.subcontractor, h.projectId || '', h.currency);
    const b = analyzeHakedis(h, hakedisler, opts);
    f.items.push(b);
    if (b.basis === 'belirsiz' || b.reasons.length > 0) f.unresolved.push(b);
    if (b.periodAmount === null) return;
    if (b.isApproved) {
      f.approvedAccrual += b.periodAmount;
      f.recordedPayment += b.recordedPayment;
    } else if (b.isPendingOrRevise) {
      f.pendingAmount += b.periodAmount;
    }
  });

  map.forEach((f) => {
    // Kümülatif üretim: onaylı kesin hesap varsa onun kümülatifi + sonrası, yoksa onaylı dönemler toplamı
    f.cumulativeProduction = f.approvedAccrual;
    f.remainingPayment = f.approvedAccrual - f.recordedPayment;
    f.remainingContract = f.contractTotal > 0 ? f.contractTotal - f.cumulativeProduction : 0;
  });

  return Array.from(map.values());
}
