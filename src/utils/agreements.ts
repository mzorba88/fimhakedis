/**
 * İş Anlaşmaları (Aşama 3) — mevcut `contracts` tablosunun JSON alanlarını
 * (work_item_entries, payment_plan) geriye uyumlu biçimde kullanır.
 * Yeni alanlar yalnızca JSON içine EK alan olarak yazılır; eski okuyucular bunları yok sayar.
 *
 * Kural: saklanan `unitPrice`, `amount` ve `totalAmount` HER ZAMAN KDV hariçtir
 * (mevcut sistemle aynı). Kullanıcının girdiği orijinal fiyat ve esası
 * `enteredUnitPrice` / `priceBasis` olarak ayrıca saklanır.
 */
import type { Currency, PaymentInstallment, WorkEntry, WorkItemEntry } from '@/types/hakedis';

export type EnteredBasis = 'kdv_haric' | 'kdv_dahil';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

export function toNet(price: number, basis: EnteredBasis, vatRate?: number): number {
  if (basis === 'kdv_dahil') {
    if (!vatRate || vatRate <= 0) throw new Error('KDV dahil fiyat için KDV oranı gerekli');
    return r4(price / (1 + vatRate / 100));
  }
  return price;
}

export function vatBreakdown(net: number, vatRate?: number) {
  const vat = vatRate && vatRate > 0 ? r2(net * (vatRate / 100)) : 0;
  return { net: r2(net), vat, gross: r2(net + vat) };
}

// ---------------- Birim fiyatlı ----------------
export interface UnitPriceRowInput {
  id?: string;
  description: string;
  workCategory: string;
  unit: string;
  unitPrice: number; // kullanıcının girdiği (esasa göre)
  estimatedQuantity?: number | null; // boş = bilinmiyor
  priceSource?: string; // "SZ-1012 · 12.03.2025" gibi bilgi
}

export interface AgreementHeader {
  projectId: string;
  subcontractor: string;
  currency: Currency;
  vatRate?: number;
  priceBasis: EnteredBasis;
  description?: string;
  date: string;
  contractNo: string;
  createdBy: string;
}

export type AgreementPayload = Omit<WorkEntry, 'id' | 'createdAt' | 'updatedAt'>;

export interface UnitPriceResult {
  payload: AgreementPayload;
  /** Tüm kalemlerin tahmini miktarı biliniyor mu */
  totalIsComplete: boolean;
  missingQuantityCount: number;
}

export function buildUnitPriceAgreement(h: AgreementHeader, rows: UnitPriceRowInput[]): UnitPriceResult {
  const clean = rows.filter((r) => (r.description || '').trim());
  if (!h.projectId || !h.subcontractor) throw new Error('Proje ve altyüklenici zorunlu');
  if (!clean.length) throw new Error('En az bir fiyat kalemi girin');
  clean.forEach((r) => {
    if (!(r.unitPrice > 0)) throw new Error(`"${r.description}" için birim fiyat girin`);
    if (!(r.unit || '').trim()) throw new Error(`"${r.description}" için birim girin`);
  });
  let missing = 0;
  const items: WorkItemEntry[] = clean.map((r, i) => {
    const qtyKnown = r.estimatedQuantity != null && r.estimatedQuantity > 0;
    if (!qtyKnown) missing++;
    return {
      id: r.id || `wie${Date.now()}_${i}`,
      workCategory: r.workCategory || '',
      description: r.description.trim(),
      unit: r.unit.trim(),
      quantity: qtyKnown ? Number(r.estimatedQuantity) : 0,
      unitPrice: toNet(r.unitPrice, h.priceBasis, h.vatRate),
      currency: h.currency,
      enteredUnitPrice: r.unitPrice,
      priceBasis: h.priceBasis,
      quantityUnknown: !qtyKnown,
      priceSource: r.priceSource,
    };
  });
  const total = r2(items.reduce((s, w) => s + w.quantity * w.unitPrice, 0));
  const categories = [...new Set(items.map((i) => i.workCategory).filter(Boolean))];
  return {
    payload: {
      contractNo: h.contractNo,
      projectId: h.projectId,
      workCategory: categories[0] || 'Sınıflandırılmamış',
      subcontractor: h.subcontractor,
      contractType: 'birim_fiyat',
      date: h.date,
      currency: h.currency,
      vatRate: h.vatRate,
      description: h.description || undefined,
      workItemEntries: items,
      createdBy: h.createdBy,
      approvalStatus: 'onay_bekliyor',
      totalAmount: total,
      paymentStatus: 'odenmedi',
    },
    totalIsComplete: missing === 0,
    missingQuantityCount: missing,
  };
}

// ---------------- Götürü bedelli ----------------
export interface PlanRowInput {
  id?: string;
  name: string;
  mode: 'yuzde' | 'tutar';
  percentage?: number;
  amount?: number; // esasa göre girilen tutar
  dueDate?: string;
  note?: string;
}

export interface PlanCheck {
  sumAmount: number; // KDV hariç
  sumPercent: number;
  difference: number; // anlaşma bedeli − aşama toplamı (KDV hariç)
  ok: boolean;
  message?: string;
}

export function checkPaymentPlan(totalNet: number, plan: { amount: number }[], complete: boolean): PlanCheck {
  const sumAmount = r2(plan.reduce((s, p) => s + (p.amount || 0), 0));
  const sumPercent = totalNet > 0 ? r2((sumAmount / totalNet) * 100) : 0;
  const difference = r2(totalNet - sumAmount);
  if (!plan.length) return { sumAmount, sumPercent, difference, ok: !complete, message: complete ? 'Ödeme planı boş' : undefined };
  if (difference < -0.01) return { sumAmount, sumPercent, difference, ok: false, message: 'Aşama toplamı anlaşma bedelini aşıyor' };
  if (complete && Math.abs(difference) > 0.01) return { sumAmount, sumPercent, difference, ok: false, message: 'Plan eksiksiz işaretli; aşamaların toplamı %100 olmalı' };
  if (Math.abs(difference) > 0.01) return { sumAmount, sumPercent, difference, ok: true, message: 'Aşama toplamı anlaşma bedelinden farklı' };
  return { sumAmount, sumPercent, difference, ok: true };
}

export interface LumpSumInput {
  totalAmount: number; // esasa göre girilen
  workCategory: string;
  plan: PlanRowInput[];
  planComplete: boolean;
}

export function buildLumpSumAgreement(h: AgreementHeader, input: LumpSumInput): { payload: AgreementPayload; check: PlanCheck } {
  if (!h.projectId || !h.subcontractor) throw new Error('Proje ve altyüklenici zorunlu');
  if (!(input.totalAmount > 0)) throw new Error('Anlaşılan toplam bedeli girin');
  const totalNet = r2(toNet(input.totalAmount, h.priceBasis, h.vatRate));
  const plan: PaymentInstallment[] = input.plan
    .filter((p) => (p.name || '').trim())
    .map((p, i) => {
      const amountNet =
        p.mode === 'yuzde'
          ? r2((totalNet * (p.percentage || 0)) / 100)
          : r2(toNet(p.amount || 0, h.priceBasis, h.vatRate));
      return {
        id: p.id || `pi${Date.now()}_${i}`,
        description: p.name.trim(),
        amount: amountNet,
        currency: h.currency,
        dueDate: p.dueDate || undefined,
        // Aşamanın tamamlanması/hakedişe bağlanması ödeme DEĞİLDİR.
        isPaid: false,
        name: p.name.trim(),
        percentage: p.mode === 'yuzde' ? p.percentage : totalNet > 0 ? r2((amountNet / totalNet) * 100) : undefined,
        inputMode: p.mode,
        note: p.note || undefined,
        priceBasis: h.priceBasis,
        planComplete: input.planComplete,
        agreementTotalNet: totalNet,
        enteredAgreementTotal: input.totalAmount,
      };
    });
  const check = checkPaymentPlan(totalNet, plan, input.planComplete);
  if (!check.ok) throw new Error(check.message);
  return {
    payload: {
      contractNo: h.contractNo,
      projectId: h.projectId,
      workCategory: input.workCategory || 'Sınıflandırılmamış',
      subcontractor: h.subcontractor,
      contractType: 'goturu_bedel',
      date: h.date,
      currency: h.currency,
      vatRate: h.vatRate,
      description: h.description || undefined,
      paymentPlan: plan,
      createdBy: h.createdBy,
      approvalStatus: 'onay_bekliyor',
      totalAmount: totalNet,
      paymentStatus: 'odenmedi',
    },
    check,
  };
}

// ---------------- Okuma ----------------
export type StoredBasis = EnteredBasis | 'bilinmiyor';

/** Kaydedilmiş fiyat esasını okur. Eski kayıtlarda 'bilinmiyor' döner — varsayım yapılmaz. */
export function readPriceBasis(c: WorkEntry): StoredBasis {
  const src = c.contractType === 'birim_fiyat' ? c.workItemEntries : c.paymentPlan;
  const b = (src || []).map((x: any) => x?.priceBasis).find(Boolean);
  return b === 'kdv_haric' || b === 'kdv_dahil' ? b : 'bilinmiyor';
}

/** Anlaşma bedeli kesin mi? Birim fiyatta miktarı bilinmeyen kalem varsa tahmini/eksik. */
export function agreementValueStatus(c: WorkEntry): 'kesin' | 'tahmini_eksik' | 'bedel_yok' {
  if (c.contractType === 'birim_fiyat') {
    const items = c.workItemEntries || [];
    if (!items.length) return 'bedel_yok';
    if (items.some((i) => i.quantityUnknown || !(i.quantity > 0))) return 'tahmini_eksik';
    return 'kesin';
  }
  return c.totalAmount > 0 ? 'kesin' : 'bedel_yok';
}

/**
 * Hakedişe bağlanmış götürü aşamaları (sonraki aşama için hazır).
 * Bağlantı hakediş kalemindeki `planItemId` alanından okunur; mevcut kayıtlarda yoktur.
 */
export function linkedPlanItems(contractId: string, hakedisler: { contractId: string; planItemId?: string; approvalStatus: string }[]) {
  return new Set(hakedisler.filter((h) => h.contractId === contractId && h.planItemId).map((h) => h.planItemId as string));
}
