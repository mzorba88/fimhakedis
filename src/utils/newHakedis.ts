/**
 * Aşama 4A — Yeni hakediş giriş ekranının saf hesaplama fonksiyonları.
 * Mevcut fonksiyonları yeniden kullanır (snapshot, planItemUsage, validatePlanLinks, vatBreakdown, toNet, priceMemory).
 * Hiçbir kaydı değiştirmez; yalnızca kaydedilecek yeni hakediş verisini hazırlar.
 */
import type {
  ApprovalStatus, Currency, ExtraWorkItem, HakedisItem, HakedisRecordType, PaymentStatus,
  PlanLink, SubcontractorHakedis, WorkEntry, WorkItemEntry,
} from '@/types/hakedis';
import { planItemUsage, snapshotItemForHakedis, stableId, toNet, validatePlanLinks, vatBreakdown, type EnteredBasis } from './agreements';
import { suggestUnitPrice, type PriceObservation, type PriceSuggestion } from './priceMemory';

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export type NewHakedisKind = HakedisRecordType | 'sozlesmesiz';

/** Birim fiyat satırı (anlaşma kaleminden otomatik gelir) */
export interface UnitRow {
  workItemEntryId: string;
  description: string;
  workCategory: string;
  unit: string;
  /** Anlaşmadaki geçerli birim fiyat (KDV hariç) */
  agreementUnitPrice: number;
  /** Bu hakedişte uygulanacak birim fiyat (KDV hariç). Boş = anlaşma fiyatı */
  overrideUnitPrice: number | null;
  overrideReason: string;
  /** Bu dönem yapılan YENİ metraj; boş = hakedişe girmez */
  quantity: number | null;
  /** Bilgi amaçlı: önceki ONAYLI hakedişlerde bu kalem için girilen metraj */
  prevApprovedQty: number;
  /** Bilgi amaçlı: onay bekleyen hakedişlerdeki metraj */
  prevPendingQty: number;
  contractQuantity?: number;
}

export interface ExtraRow {
  id: string;
  description: string;
  workCategory: string;
  unit: string;
  quantity: number | null;
  /** Girilen birim fiyat (giriş esasında) */
  unitPrice: number | null;
  /** Birim fiyat yerine doğrudan toplam (giriş esasında) */
  lumpAmount: number | null;
}

/** Önceki metrajlar: yalnızca bilgi. Revize hakedişler sayılmaz. Hiçbir zaman yeni miktara eklenmez. */
export function previousQuantities(contractId: string, hakedisler: SubcontractorHakedis[]) {
  const approved = new Map<string, number>();
  const pending = new Map<string, number>();
  hakedisler
    .filter((h) => h.contractId === contractId && h.approvalStatus !== 'revize')
    .forEach((h) => {
      const m = h.approvalStatus === 'onaylandi' ? approved : pending;
      (h.hakedisItems || []).forEach((it) => {
        if (!it?.workItemEntryId) return;
        m.set(it.workItemEntryId, r2((m.get(it.workItemEntryId) || 0) + (Number(it.quantity) || 0)));
      });
    });
  return { approved, pending };
}

/** Birim fiyatlı anlaşmanın bütün kalemlerini hakediş satırı olarak getirir. Miktarlar boş başlar. */
export function buildUnitRows(contract: WorkEntry, hakedisler: SubcontractorHakedis[]): UnitRow[] {
  const prev = previousQuantities(contract.id, hakedisler);
  return (contract.workItemEntries || [])
    .filter((w) => w && (w.description || '').trim())
    .map((w) => ({
      workItemEntryId: w.id,
      description: w.description || '',
      workCategory: w.workCategory || contract.workCategory || '',
      unit: w.unit || '',
      agreementUnitPrice: Number(w.unitPrice) || 0,
      overrideUnitPrice: null,
      overrideReason: '',
      quantity: null,
      prevApprovedQty: prev.approved.get(w.id) || 0,
      prevPendingQty: prev.pending.get(w.id) || 0,
      contractQuantity: w.quantity || undefined,
    }));
}

export const effectiveUnitPrice = (r: UnitRow) => (r.overrideUnitPrice != null && r.overrideUnitPrice >= 0 ? r.overrideUnitPrice : r.agreementUnitPrice);
export const unitRowAmount = (r: UnitRow) => (r.quantity && r.quantity > 0 ? r2(r.quantity * effectiveUnitPrice(r)) : 0);
export const isPriceOverridden = (r: UnitRow) => r.overrideUnitPrice != null && Math.abs(r.overrideUnitPrice - r.agreementUnitPrice) > 0.0001;

/**
 * Miktarı girilen satırları değişmez hakediş kalemine çevirir (snapshotItemForHakedis).
 * Fiyat değiştirildiyse yalnızca bu kayda uygulanır; anlaşma fiyatı agreementUnitPrice olarak saklanır.
 */
export function buildHakedisItems(rows: UnitRow[], contract: WorkEntry): HakedisItem[] {
  return rows
    .filter((r) => r.quantity != null && r.quantity > 0)
    .map((r) => {
      const source: WorkItemEntry = (contract.workItemEntries || []).find((w) => w.id === r.workItemEntryId) || {
        id: r.workItemEntryId, workCategory: r.workCategory, description: r.description, unit: r.unit,
        quantity: 0, unitPrice: r.agreementUnitPrice, currency: contract.currency,
      };
      const snap = snapshotItemForHakedis(
        { ...source, workCategory: r.workCategory, unitPrice: effectiveUnitPrice(r) },
        r.quantity as number,
      );
      const item: HakedisItem = { ...snap, agreementUnitPrice: r.agreementUnitPrice };
      if (isPriceOverridden(r) && r.overrideReason.trim()) item.priceOverrideReason = r.overrideReason.trim();
      return item;
    });
}

/** Ek iş satırları: giriş esasına göre KDV hariç saklanır. Boş satırlar atlanır. */
export function buildExtraItems(rows: ExtraRow[], basis: EnteredBasis, vatRate?: number): ExtraWorkItem[] {
  return rows
    .filter((r) => (r.description || '').trim())
    .map((r) => {
      const qty = Number(r.quantity) || 0;
      let unitNet: number; let amount: number;
      if (r.lumpAmount != null && r.lumpAmount > 0 && !(r.unitPrice && r.unitPrice > 0)) {
        amount = r2(toNet(r.lumpAmount, basis, vatRate));
        unitNet = qty > 0 ? r2(amount / qty) : amount;
      } else {
        unitNet = toNet(Number(r.unitPrice) || 0, basis, vatRate);
        amount = r2(qty * unitNet);
        unitNet = r2(unitNet);
      }
      const out: ExtraWorkItem = { id: r.id || stableId('ex'), description: r.description.trim(), unit: r.unit || 'adet', unitPrice: unitNet, quantity: qty || (amount > 0 ? 1 : 0), amount };
      if ((r.workCategory || '').trim()) out.workCategory = r.workCategory.trim();
      return out;
    })
    .filter((x) => x.amount > 0);
}

export interface PlanSelection { planItemId: string; amount: number | null }

/** Seçilen aşamaları plan_links'e çevirir (tutarlar KDV hariç, giriş esasından dönüştürülür) */
export function buildPlanLinks(sel: PlanSelection[], basis: EnteredBasis, vatRate?: number): PlanLink[] {
  return sel
    .filter((s) => s.amount != null && s.amount > 0)
    .map((s) => ({ planItemId: s.planItemId, amount: r2(toNet(s.amount as number, basis, vatRate)) }));
}

/** Aşama bağlantıları doğrulaması + ana iş tutarıyla karşılaştırma (ek işler dahil edilmez) */
export function checkPlanLinks(contract: WorkEntry, links: PlanLink[], hakedisler: SubcontractorHakedis[], mainWorkNet: number) {
  const errors = validatePlanLinks(contract, links, hakedisler);
  const linked = r2(links.reduce((s, l) => s + l.amount, 0));
  const warnings: string[] = [];
  if (links.length && Math.abs(linked - mainWorkNet) > 0.01)
    warnings.push(`Aşamalara bağlanan toplam (${linked.toFixed(2)}) ana iş tutarından (${mainWorkNet.toFixed(2)}) farklı`);
  return { errors, warnings, linked };
}

/** Planı olmayan götürü anlaşma: bilgi amaçlı bedel/önceki tahakkuk özeti. Sözleşme toplamını dönem hakedişi saymaz. */
export function lumpSumContext(contract: WorkEntry, hakedisler: SubcontractorHakedis[]) {
  const rel = hakedisler.filter((h) => h.contractId === contract.id && h.approvalStatus !== 'revize' && h.hakedisType !== 'alelhesap');
  const approved = r2(rel.filter((h) => h.approvalStatus === 'onaylandi').reduce((s, h) => s + (Number(h.totalAmount) || 0), 0));
  const pending = r2(rel.filter((h) => h.approvalStatus === 'onay_bekliyor').reduce((s, h) => s + (Number(h.totalAmount) || 0), 0));
  const total = Number(contract.totalAmount) || 0;
  return { total, approved, pending, remaining: r2(total - approved - pending) };
}

export function summarize(net: number, vatRate?: number) {
  const b = vatBreakdown(r2(net), vatRate);
  return { net: r2(net), vatRate: vatRate || 0, vat: r2(b.vat), gross: r2(b.gross) };
}

/** Anlaşma fiyatı birinci öncelik; priceMemory ikinci/üçüncü kaynak (yalnızca gösterim/alternatif) */
export function priceInfo(row: UnitRow, ctx: { subcontractor: string; projectId: string; currency: Currency }, obs: PriceObservation[]): PriceSuggestion {
  return suggestUnitPrice({ ...ctx, description: row.description, unit: row.unit }, obs);
}

/** Mevcut numaralandırma kuralı (MultiProjectHakedisDialog ile aynı) */
export function nextContractHakedisNo(contract: WorkEntry, type: HakedisRecordType, hakedisler: SubcontractorHakedis[]) {
  const prefix = type === 'alelhesap' ? 'AH' : type === 'kesin_hesap' ? 'KH' : 'H';
  const nums = hakedisler
    .filter((h) => h.contractId === contract.id && (h.hakedisNo || '').includes(`-${prefix}`))
    .map((h) => { const m = (h.hakedisNo || '').match(new RegExp(`-${prefix}(\\d+)$`)); return m ? parseInt(m[1], 10) : 0; });
  const n = nums.length ? Math.max(...nums) + 1 : 1;
  return `${contract.contractNo}-${prefix}${String(n).padStart(2, '0')}`;
}

export function nextSmallHakedisNo(hakedisler: SubcontractorHakedis[]) {
  const nums = hakedisler.map((h) => { const m = (h.hakedisNo || '').match(/^KH-S(\d+)$/); return m ? parseInt(m[1], 10) : 0; });
  const n = nums.length ? Math.max(0, ...nums) + 1 : 1;
  return `KH-S${String(n).padStart(3, '0')}`;
}

export interface BuildInput {
  kind: NewHakedisKind;
  contract?: WorkEntry;
  projectId: string;
  subcontractor: string;
  currency: Currency;
  vatRate?: number;
  date: string;
  description?: string;
  isUrgent: boolean;
  basis: EnteredBasis;
  unitRows: UnitRow[];
  extraRows: ExtraRow[];
  /** Götürü / alelhesap serbest tutar (giriş esasında) */
  freeAmount: number | null;
  planSelections: PlanSelection[];
  /** Yeni alelhesaplar için kalıcı sınıflandırma (migration sonrası). */
  alelhesapNature?: 'avans' | 'tahakkuk';
  user: { id: string; role: string; label: string };
  hakedisler: SubcontractorHakedis[];
  subWorkCategory?: string;
}

export interface BuildResult {
  data: Omit<SubcontractorHakedis, 'id' | 'createdAt' | 'updatedAt'> | null;
  errors: string[];
  warnings: string[];
  mainNet: number;
  extraNet: number;
}

/** Kaydedilecek yeni hakediş verisini hazırlar. Kesin hesap bu ekranda desteklenmez (Aşama 4B). */
export function buildNewHakedis(i: BuildInput): BuildResult {
  const errors: string[] = []; const warnings: string[] = [];
  if (!i.subcontractor) errors.push('Altyüklenici seçilmedi');
  if (i.kind === 'kesin_hesap') errors.push('Kesin hesap bu ekranda hazırlanmaz; mevcut formu kullanın (Aşama 4B)');
  if (i.kind !== 'sozlesmesiz' && !i.contract) errors.push('İş anlaşması seçilmedi');
  if (!i.projectId) errors.push('Proje seçilmedi');
  if (i.basis === 'kdv_dahil' && !(Number(i.vatRate) > 0)) {
    errors.push('KDV dahil giriş için KDV oranı gerekli');
    return { data: null, errors, warnings, mainNet: 0, extraNet: 0 };
  }

  const extraItems = buildExtraItems(i.extraRows, i.basis, i.vatRate);
  const extraNet = r2(extraItems.reduce((s, x) => s + x.amount, 0));
  let mainNet = 0; let hakedisItems: HakedisItem[] | undefined; let paymentAmount: number | undefined; let planLinks: PlanLink[] | undefined;

  const c = i.contract;
  if (i.kind === 'alelhesap') {
    if (!i.alelhesapNature) errors.push('Alelhesap için avans veya tahakkuk seçilmelidir');
    mainNet = r2(toNet(Number(i.freeAmount) || 0, i.basis, i.vatRate));
    paymentAmount = mainNet;
  } else if (i.kind === 'ara_hakedis' && c?.contractType === 'birim_fiyat') {
    hakedisItems = buildHakedisItems(i.unitRows, c);
    mainNet = r2(hakedisItems.reduce((s, x) => s + x.amount, 0));
    i.unitRows.filter((r) => r.quantity && r.quantity > 0 && isPriceOverridden(r) && !r.overrideReason.trim())
      .forEach((r) => warnings.push(`"${r.description}" için fiyat değiştirildi; gerekçe girilmedi`));
  } else if (i.kind === 'ara_hakedis' && c?.contractType === 'goturu_bedel') {
    const hasPlan = (c.paymentPlan || []).some((p) => p?.id);
    const links = hasPlan ? buildPlanLinks(i.planSelections, i.basis, i.vatRate) : [];
    if (links.length) {
      mainNet = r2(links.reduce((s, l) => s + l.amount, 0));
      const chk = checkPlanLinks(c, links, i.hakedisler, mainNet);
      errors.push(...chk.errors); warnings.push(...chk.warnings);
      planLinks = links;
    } else {
      mainNet = r2(toNet(Number(i.freeAmount) || 0, i.basis, i.vatRate));
      if (hasPlan && mainNet > 0) warnings.push('Ödeme aşaması seçilmedi; tutar hiçbir aşamaya bağlanmadan kaydedilecek');
    }
    paymentAmount = mainNet;
  } else if (i.kind === 'sozlesmesiz') {
    mainNet = 0; // sözleşmesiz hakedişte tüm kalemler ek iş tablosunda (mevcut yapı)
  }

  const total = r2(mainNet + extraNet);
  if (!(total > 0)) errors.push('Hakediş tutarı sıfır — en az bir miktar veya tutar girin');
  if (errors.length) return { data: null, errors, warnings, mainNet, extraNet };

  const isDir = i.user.role === 'direktor';
  const base = {
    subcontractor: i.subcontractor, currency: i.currency, date: i.date, isUrgent: i.isUrgent,
    createdBy: i.user.id,
    approvalStatus: (isDir ? 'onaylandi' : 'onay_bekliyor') as ApprovalStatus,
    approvedBy: isDir ? i.user.label : undefined,
    approvalDate: isDir ? new Date().toISOString() : undefined,
    paidAmount: 0, paymentStatus: 'odenmedi' as PaymentStatus,
  };

  if (i.kind === 'sozlesmesiz') {
    const label = i.subWorkCategory ? `[${i.subWorkCategory}] ` : '';
    const auto = extraItems.map((x) => `${x.description} (${x.quantity} ${x.unit})`).join('; ');
    return {
      data: {
        ...base, hakedisNo: nextSmallHakedisNo(i.hakedisler), hakedisType: 'ara_hakedis', projectId: i.projectId,
        contractId: null as any, contractNo: null as any, contractType: 'goturu_bedel',
        vatRate: i.vatRate && i.vatRate > 0 ? i.vatRate : (null as any),
        description: `${label}${(i.description || '').trim() || auto}`,
        paymentAmount: total, extraItems, totalAmount: total,
      },
      errors, warnings, mainNet, extraNet,
    };
  }
  const contract = c as WorkEntry;
  return {
    data: {
      ...base, hakedisNo: nextContractHakedisNo(contract, i.kind as HakedisRecordType, i.hakedisler),
      hakedisType: i.kind as HakedisRecordType, projectId: i.projectId, contractId: contract.id, contractNo: contract.contractNo,
      contractType: contract.contractType, vatRate: i.vatRate, description: (i.description || '').trim() || undefined,
      ...(i.kind === 'alelhesap' && i.alelhesapNature ? { alelhesapNature: i.alelhesapNature } : {}),
      paymentAmount, hakedisItems: hakedisItems && hakedisItems.length ? hakedisItems : undefined,
      extraItems: extraItems.length ? extraItems : undefined,
      ...(planLinks ? { planLinks } : {}),
      totalAmount: total, offsetAmount: 0,
    },
    errors, warnings, mainNet, extraNet,
  };
}

export { planItemUsage };
