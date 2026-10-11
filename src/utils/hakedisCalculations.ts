import { agreementValueStatus, countsInContractTotal } from './agreements';
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
  /**
   * Kesin hesap mahsubu yalnızca ara hakedişlerle eşleşiyorsa, aynı dosyadaki
   * alelhesaplar tahakkuk değil AVANS ödemesi kabul edilir.
   */
  alelhesapAsAdvance?: boolean;
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
  let alelAdvance = false;

  const override = opts.basisOverrides?.[h.id];

  if (h.hakedisType !== 'kesin_hesap') {
    basis = override ?? 'donem';
  } else if (override) {
    basis = override;
    reasons.push('Giriş esası manuel olarak teyit edildi');
  } else if ([...(h.hakedisItems || []), ...(h.extraItems || [])].some(it => it.settlementSnapshot === 'cumulative_v4b')) {
    // Yeni kesin hesaplarda mahsup kaynağı açıkça işaretlenmiştir; eski kayıtların
    // belirsiz avans/tahakkuk türünü TAHMİN ETME.
    const related = sameFile(h, all).filter(o => o.hakedisType !== 'kesin_hesap');
    const unclassified = related.filter(o => o.hakedisType === 'alelhesap' && !o.alelhesapNature);
    const after = related.filter(o => (o.date || '') > (h.date || ''));
    const pending = related.filter(o => o.approvalStatus === 'onay_bekliyor');
    const accrued = related.filter(o => o.approvalStatus === 'onaylandi' &&
      (o.hakedisType === 'ara_hakedis' || o.hakedisType === 'alelhesap' && o.alelhesapNature === 'tahakkuk'));
    const expected = accrued.reduce((s, o) => s + (o.totalAmount || 0), 0);
    if (unclassified.length || after.length || pending.length || Math.abs(offset - expected) > 0.02) {
      basis = 'belirsiz';
      if (unclassified.length) reasons.push('Alelhesap sınıflandırması eksik');
      if (after.length) reasons.push('Kesin hesaptan sonra başka kayıt var');
      if (pending.length) reasons.push('Önceki hakediş onayı bekleniyor');
      if (Math.abs(offset - expected) > 0.02) reasons.push('Önceki onaylı tahakkuklar kesin hesap mahsubuyla uyuşmuyor');
    } else {
      basis = 'kumulatif';
    }
  } else {
    const prev = sameFile(h, all).filter((o) => o.hakedisType !== 'kesin_hesap');
    const before = prev.filter((o) => (o.date || '') <= (h.date || ''));
    const after = prev.filter((o) => (o.date || '') > (h.date || ''));
    const prevSum = before.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const araSum = before
      .filter((o) => o.hakedisType !== 'alelhesap')
      .reduce((s, o) => s + (o.totalAmount || 0), 0);
    const hasAlel = before.some((o) => o.hakedisType === 'alelhesap');

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
    } else if (hasAlel && araSum > 0 && Math.abs(offset - araSum) <= tolFor(araSum, opts.tolerance)) {
      // Mahsup yalnızca ara hakedişleri düşmüş: alelhesaplar avans ödemesidir
      basis = 'kumulatif';
      alelAdvance = true;
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
    alelhesapAsAdvance: alelAdvance || undefined,
  };
}

export interface FileSummary {
  subcontractor: string;
  projectId: string;
  currency: Currency;
  /** Anlaşılan sözleşme bedeli */
  contractTotal: number;
  /** Kümülatif gerçekleşen (onaylı) imalat */
  cumulativeProduction: number;
  /** Onaylı dönem tahakkukları toplamı (avans niteliğindeki alelhesaplar hariç) */
  approvedAccrual: number;
  araAccrual: number;
  alelhesapAccrual: number;
  kesinAccrual: number;
  /** Avans niteliğindeki alelhesap ödemeleri (tahakkuk değil, yalnızca ödeme) */
  advancePayments: number;
  /** Onay bekleyen / revize — kesinleşmiş borç değil */
  pendingAmount: number;
  /** Kayıtlı fiili ödemeler (avanslar dahil) */
  recordedPayment: number;
  /** Kalan ödeme bakiyesi; negatifse fazla ödeme */
  remainingPayment: number;
  /** Fazla Ödeme / Devreden Avans (pozitif sayı) */
  overpayment: number;
  remainingContract: number;
  /** Bedeli kesin/tam tahmini olmayan anlaşmalar (kısmi metraj veya yalnızca birim fiyat) — toplama katılmaz */
  incompleteContracts: string[];
  /** Aynı tutarlar KDV dahil (her kaydın kendi KDV oranıyla) */
  vat: { approvedAccrual: number; recordedPayment: number; remainingPayment: number; contractTotal: number };
  unresolved: HakedisBreakdown[];
  items: HakedisBreakdown[];
  /** Belirsiz kayıt yoksa true — false ise bakiye kesin gösterilmemeli */
  reliable: boolean;
}

const vatF = (r?: number | null) => 1 + (r && r > 0 ? r : 0) / 100;
const fileKey = (sub: string, projectId: string, currency: string) => `${sub}__${projectId || 'none'}__${currency}`;

/** Altyüklenici + proje + para birimi dosyası özeti. Para birimleri asla karışmaz. */
export function summarizeFiles(
  hakedisler: SubcontractorHakedis[],
  contracts: WorkEntry[],
  opts: CalcOptions = {}
): FileSummary[] {
  const map = new Map<string, FileSummary>();
  const ensure = (sub: string, projectId: string, currency: Currency) => {
    const key = fileKey(sub, projectId, currency);
    if (!map.has(key))
      map.set(key, {
        subcontractor: sub, projectId, currency,
        contractTotal: 0, cumulativeProduction: 0, approvedAccrual: 0,
        araAccrual: 0, alelhesapAccrual: 0, kesinAccrual: 0, advancePayments: 0,
        pendingAmount: 0, recordedPayment: 0, remainingPayment: 0, overpayment: 0, remainingContract: 0,
        vat: { approvedAccrual: 0, recordedPayment: 0, remainingPayment: 0, contractTotal: 0 },
        unresolved: [], items: [], reliable: true, incompleteContracts: [],
      });
    return map.get(key)!;
  };

  contracts.forEach((c) => {
    const f = ensure(c.subcontractor, c.projectId, c.currency);
    if (!countsInContractTotal(c)) {
      if (agreementValueStatus(c) !== 'bedel_yok') f.incompleteContracts.push(c.contractNo);
      return;
    }
    f.contractTotal += c.totalAmount || 0;
    f.vat.contractTotal += (c.totalAmount || 0) * vatF(c.vatRate);
  });

  const breakdowns = new Map<string, HakedisBreakdown>();
  hakedisler.forEach((h) => breakdowns.set(h.id, analyzeHakedis(h, hakedisler, opts)));

  // Avans niteliğindeki alelhesaplar: mahsubu yalnız ara hakedişlerle eşleşen kesin hesabın dosyası
  const advanceIds = new Set<string>();
  hakedisler.forEach((h) => {
    if (h.hakedisType === 'kesin_hesap' && breakdowns.get(h.id)?.alelhesapAsAdvance) {
      sameFile(h, hakedisler)
        .filter((o) => o.hakedisType === 'alelhesap' && (o.date || '') <= (h.date || ''))
        .forEach((o) => advanceIds.add(o.id));
    }
  });

  hakedisler.forEach((h) => {
    const f = ensure(h.subcontractor, h.projectId || '', h.currency);
    const b = breakdowns.get(h.id)!;
    f.items.push(b);
    if (b.basis === 'belirsiz' || b.reasons.length > 0) f.unresolved.push(b);
    if (b.periodAmount === null) return;
    const vf = vatF(h.vatRate);
    const isAdvance = h.hakedisType === 'alelhesap'
      ? h.alelhesapNature === 'avans' || (!h.alelhesapNature && advanceIds.has(h.id))
      : advanceIds.has(h.id);
    if (b.isApproved) {
      if (isAdvance) {
        f.advancePayments += b.recordedPayment;
      } else {
        f.approvedAccrual += b.periodAmount;
        f.vat.approvedAccrual += b.periodAmount * vf;
        if (h.hakedisType === 'alelhesap') f.alelhesapAccrual += b.periodAmount;
        else if (h.hakedisType === 'kesin_hesap') f.kesinAccrual += b.periodAmount;
        else f.araAccrual += b.periodAmount;
      }
      // Ödeme her kayıtta bir kez sayılır (avans da olsa tahakkuk da olsa) — mükerrer düşüm yok
      f.recordedPayment += b.recordedPayment;
      f.vat.recordedPayment += b.recordedPayment * vf;
    } else if (b.isPendingOrRevise && !isAdvance) {
      f.pendingAmount += b.periodAmount;
    }
  });

  map.forEach((f) => {
    f.cumulativeProduction = f.approvedAccrual;
    f.remainingPayment = f.approvedAccrual - f.recordedPayment;
    f.vat.remainingPayment = f.vat.approvedAccrual - f.vat.recordedPayment;
    f.overpayment = f.remainingPayment < -0.0049 ? -f.remainingPayment : 0;
    f.remainingContract = f.contractTotal > 0 && f.incompleteContracts.length === 0 ? f.contractTotal - f.cumulativeProduction : 0;
    f.reliable = f.unresolved.length === 0;
  });

  return Array.from(map.values());
}

/* =========================================================================
 * KESİN HESAP ÖZETİ (gelecek kesin hesap ekranı için — Aşama 1C)
 * Girdi: nihai kümülatif imalat (KDV hariç). Önceki onaylı ara hakedişler
 * tahakkuktan, avans niteliğindeki alelhesaplar yalnızca ödemeden düşülür.
 * ========================================================================= */
export interface FinalSettlementSummary {
  finalProduction: number;
  previousAraAccrual: number;
  /** Tahakkuk niteliğindeki alelhesaplar (mahsuba girer) */
  previousAlelhesapAccrual: number;
  /** Onay bekleyen önceki kayıtlar — mahsuba girmez, uyarı verilir */
  previousPending: number;
  newPeriodAccrual: number;
  advancePayments: number;
  otherPayments: number;
  /** Önceki ara hakedişlerden ödenmemiş kalan */
  previousUnpaid: number;
  remainingPayment: number;
  overpayment: number;
  vatRate: number;
  excl: number;
  vatAmount: number;
  incl: number;
  warnings: string[];
}

export function computeFinalSettlementSummary(params: {
  finalProduction: number;
  vatRate?: number;
  /** Aynı dosyadaki önceki kayıtlar (ara/alelhesap) */
  previous: SubcontractorHakedis[];
  /** 'tahakkuk': alelhesap ölçülmüş işe karşılık; 'avans': yalnızca ödeme; undefined: belirsiz */
  alelhesapNature?: 'tahakkuk' | 'avans';
}): FinalSettlementSummary {
  const { finalProduction, vatRate = 0, previous, alelhesapNature } = params;
  const warnings: string[] = [];
  const approved = previous.filter((h) => h.approvalStatus === 'onaylandi' && h.hakedisType !== 'kesin_hesap');
  const pending = previous.filter(
    (h) => (h.approvalStatus === 'onay_bekliyor' || h.approvalStatus === 'revize') && h.hakedisType !== 'kesin_hesap'
  );
  const ara = approved.filter((h) => h.hakedisType !== 'alelhesap');
  const alel = approved.filter((h) => h.hakedisType === 'alelhesap');
  const pay = (h: SubcontractorHakedis) => h.paidAmount || 0;

  if (alel.length > 0 && !alelhesapNature)
    warnings.push('Alelhesabın niteliği (avans / tahakkuk) belirlenmedi — otomatik mahsup yapılmadı, manuel inceleme gerekli');
  if (pending.length > 0)
    warnings.push(`${pending.length} önceki kayıt onay bekliyor — onaylanınca mahsuba eklenmeli`);

  const previousAraAccrual = ara.reduce((s, h) => s + (h.totalAmount || 0), 0);
  const previousAlelhesapAccrual = alelhesapNature === 'tahakkuk' ? alel.reduce((s, h) => s + (h.totalAmount || 0), 0) : 0;
  const advancePayments = alelhesapNature === 'avans' ? alel.reduce((s, h) => s + pay(h), 0) : 0;
  const alelPaidAsAccrual = alelhesapNature === 'tahakkuk' ? alel.reduce((s, h) => s + pay(h), 0) : 0;
  const otherPayments = ara.reduce((s, h) => s + pay(h), 0) + alelPaidAsAccrual;
  const previousUnpaid = ara.reduce((s, h) => s + Math.max(0, (h.totalAmount || 0) - pay(h)), 0);

  const newPeriodAccrual = finalProduction - previousAraAccrual - previousAlelhesapAccrual;
  if (newPeriodAccrual < 0) warnings.push('Nihai imalat önceki tahakkuklardan küçük — manuel inceleme gerekli');

  const blocked = alel.length > 0 && !alelhesapNature;
  const remainingRaw = finalProduction - otherPayments - advancePayments;
  const remainingPayment = blocked ? NaN : remainingRaw;
  const overpayment = !blocked && remainingRaw < -0.0049 ? -remainingRaw : 0;
  const excl = newPeriodAccrual;
  const vatAmount = excl * (vatRate > 0 ? vatRate : 0) / 100;

  return {
    finalProduction, previousAraAccrual, previousAlelhesapAccrual,
    previousPending: pending.reduce((s, h) => s + (h.totalAmount || 0), 0),
    newPeriodAccrual, advancePayments, otherPayments, previousUnpaid,
    remainingPayment, overpayment, vatRate, excl, vatAmount, incl: excl + vatAmount, warnings,
  };
}

/* =========================================================================
 * ÖDEME GÜVENLİĞİ (Aşama 1B)
 * Tüm tutarlar KDV HARİÇ. Mevcut sistem paid_amount'u her zaman KDV hariç
 * total_amount ile karşılaştırarak yazmıştır (Payments.tsx tam/kısmi ödeme).
 * ========================================================================= */

export interface PaymentPlan {
  allowed: boolean;
  /** Bu hakediş için ödemeye esas tutar (dönem tahakkuku, KDV hariç) */
  payableAmount: number | null;
  /** Daha önce bu hakedişe kayıtlı ödeme */
  alreadyPaid: number;
  /** Bu hakediş için kalan ödeme */
  remaining: number | null;
  basis: InputBasis;
  reason?: string;
}

export function planPayment(
  h: SubcontractorHakedis,
  all: SubcontractorHakedis[],
  opts: CalcOptions = {}
): PaymentPlan {
  const b = analyzeHakedis(h, all, opts);
  const alreadyPaid = h.paidAmount || 0;
  const base = { alreadyPaid, basis: b.basis, payableAmount: b.periodAmount };

  if (h.approvalStatus !== 'onaylandi')
    return { ...base, allowed: false, remaining: null, reason: 'Onaylanmamış hakedişe ödeme yapılamaz' };
  if (b.periodAmount === null)
    return {
      ...base, allowed: false, remaining: null,
      reason: `Manuel inceleme gerekli: ${b.reasons.join('; ') || 'giriş esası belirsiz'}`,
    };
  const remaining = b.periodAmount - alreadyPaid;
  const tol = tolFor(b.periodAmount, opts.tolerance);
  if (h.paymentStatus === 'odendi' || remaining <= 0.0049) {
    if (remaining < -tol)
      return { ...base, allowed: false, remaining, reason: 'Kayıtlı ödeme ödemeye esas tutardan büyük — manuel inceleme gerekli' };
    return { ...base, allowed: false, remaining: Math.max(0, remaining), reason: 'Bu hakediş zaten ödenmiş' };
  }
  return { ...base, allowed: true, remaining };
}

export interface PaymentUpdate {
  paymentStatus: 'odendi' | 'kismen_odendi';
  paidAmount: number;
  isUrgent?: boolean;
}

/** "Tam Ödeme" butonunun veritabanına göndereceği değerler; izin yoksa null. */
export function buildFullPaymentUpdate(
  h: SubcontractorHakedis,
  all: SubcontractorHakedis[],
  opts: CalcOptions = {}
): { update: PaymentUpdate | null; plan: PaymentPlan } {
  const plan = planPayment(h, all, opts);
  if (!plan.allowed || plan.payableAmount === null) return { update: null, plan };
  return {
    plan,
    update: { paymentStatus: 'odendi', paidAmount: plan.payableAmount, isUrgent: false },
  };
}

/** "Kısmi Ödeme" için gönderilecek değerler; geçersizse error döner. */
export function buildPartialPaymentUpdate(
  h: SubcontractorHakedis,
  all: SubcontractorHakedis[],
  amount: number,
  opts: CalcOptions = {}
): { update: PaymentUpdate | null; plan: PaymentPlan; error?: string } {
  const plan = planPayment(h, all, opts);
  if (!plan.allowed || plan.remaining === null || plan.payableAmount === null)
    return { update: null, plan, error: plan.reason };
  if (!Number.isFinite(amount) || amount <= 0) return { update: null, plan, error: 'Geçerli bir tutar giriniz' };
  if (amount > plan.remaining + 0.0049)
    return { update: null, plan, error: 'Tutar bu hakedişin kalan ödemesinden fazla olamaz' };
  const newPaid = plan.alreadyPaid + amount;
  const full = newPaid >= plan.payableAmount - 0.0049;
  return {
    plan,
    update: full
      ? { paymentStatus: 'odendi', paidAmount: newPaid, isUrgent: false }
      : { paymentStatus: 'kismen_odendi', paidAmount: newPaid },
  };
}

/* ---------- Eski / yeni cari hesap karşılaştırması (salt okunur) ---------- */
export interface ComparisonRow {
  key: string;
  subcontractor: string;
  projectId: string;
  currency: Currency;
  oldApproved: number;
  oldPaid: number;
  oldRemaining: number;
  newApprovedAccrual: number;
  recordedPayment: number;
  newRemaining: number;
  difference: number;
  pendingAmount: number;
  unresolved: HakedisBreakdown[];
  /** Belirsiz kayıt varsa yeni bakiye kesin değildir */
  reliable: boolean;
}

export function compareOldNew(
  hakedisler: SubcontractorHakedis[],
  contracts: WorkEntry[],
  opts: CalcOptions = {}
): ComparisonRow[] {
  const files = summarizeFiles(hakedisler, contracts, opts);
  return files
    .filter((f) => f.items.length > 0)
    .map((f) => {
      const recs = hakedisler.filter(
        (h) => h.subcontractor === f.subcontractor && (h.projectId || '') === f.projectId && h.currency === f.currency
      );
      const appr = recs.filter((h) => h.approvalStatus === 'onaylandi');
      const oldApproved = appr.reduce((s, h) => s + (h.totalAmount || 0), 0);
      const oldPaid = recs.reduce(
        (s, h) => s + (h.paymentStatus === 'odendi' ? h.totalAmount || 0 : h.paidAmount || 0), 0
      );
      const oldRemaining = oldApproved - oldPaid;
      return {
        key: `${f.subcontractor}__${f.projectId}__${f.currency}`,
        subcontractor: f.subcontractor,
        projectId: f.projectId,
        currency: f.currency,
        oldApproved, oldPaid, oldRemaining,
        newApprovedAccrual: f.approvedAccrual,
        recordedPayment: f.recordedPayment,
        newRemaining: f.remainingPayment,
        difference: f.remainingPayment - oldRemaining,
        pendingAmount: f.pendingAmount,
        unresolved: f.unresolved,
        reliable: f.reliable,
      };
    });
}
