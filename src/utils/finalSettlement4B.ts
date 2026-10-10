/**
 * Aşama 4B — Birim fiyatlı kesin hesap için güvenli hesaplama.
 * Kesin hesaptaki kalemler KÜMÜLATİF snapshot'tır. Önceki ara hakedişler offsetAmount
 * ile düşülür; sadece yeni metraj ve YENİ ek işler dönem tahakkukuna girer.
 * Hiçbir geçmiş kayıt değiştirilmez.
 */
import type { ExtraWorkItem, HakedisItem, SubcontractorHakedis, WorkEntry } from '@/types/hakedis';
import { buildExtraItems, nextContractHakedisNo, type ExtraRow } from './newHakedis';
import { stableId, type EnteredBasis } from './agreements';

const round = (n: number) => Math.round(n * 100) / 100;
const close = (a: number, b: number) => Math.abs(a - b) <= 0.02;

export interface FinalMeter {
  workItemEntryId: string;
  finalQuantity: number | null;
  /** Sonraki/yeni metrajın KDV hariç birim fiyatı */
  newUnitPrice: number;
  workCategory: string;
}
export interface FinalInput {
  contract: WorkEntry;
  all: SubcontractorHakedis[];
  date: string;
  rows: FinalMeter[];
  /** Bu kesin hesapta ilk kez hakedişe giren ek işler */
  newExtras: ExtraRow[];
  extraBasis: EnteredBasis;
  vatRate?: number;
  description?: string;
  urgent?: boolean;
  user: { id: string; role: string; label: string };
  /** Önizleme içindir. Alelhesap varken sınıflandırma kalıcı saklanmadığından kayıt engellenir. */
  alelNature?: 'avans' | 'tahakkuk';
}
export interface FinalLine {
  key: string;
  description: string;
  unit: string;
  workCategory: string;
  previousQuantity: number;
  finalQuantity: number;
  newQuantity: number;
  previousNet: number;
  newNet: number;
  totalNet: number;
}
export interface FinalResult {
  errors: string[];
  warnings: string[];
  lines: FinalLine[];
  previousExtras: ExtraWorkItem[];
  newExtras: ExtraWorkItem[];
  previousExtraNet: number;
  newExtraNet: number;
  /** Nihai toplam üretim: önceki + yeni (KDV hariç) */
  finalNet: number;
  /** Önceki onaylı tahakkukların mahsubu */
  offsetNet: number;
  /** Kesin hesapta ilk kez tahakkuk eden üretim */
  periodNet: number;
  /** Önceki kayıtlı ödemeler (banka teyidi değildir) */
  paidNet: number;
  /** Toplam üretim eksi kayıtlı ödemeler */
  remainingNet: number | null;
  data: Omit<SubcontractorHakedis, 'id' | 'createdAt' | 'updatedAt'> | null;
}

export function prepareFinalSettlement(i: FinalInput): FinalResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const contract = i.contract;
  if (contract.contractType !== 'birim_fiyat') errors.push('Bu form yalnızca birim fiyatlı anlaşmalar içindir');
  if (!i.date) errors.push('Kesin hesap tarihi gerekli');
  if (i.extraBasis === 'kdv_dahil' && !(Number(i.vatRate) > 0)) errors.push('KDV dahil ek işler için KDV oranı gerekli');

  const related = i.all.filter(h => h.contractId === contract.id);
  const active = related.filter(h => h.approvalStatus !== 'revize');
  if (active.some(h => h.hakedisType === 'kesin_hesap')) errors.push('Bu anlaşmada kesin hesap zaten mevcut');
  if (active.some(h => h.approvalStatus !== 'onaylandi')) errors.push('Onay bekleyen hakedişleri önce sonuçlandırın');
  if (active.some(h => h.date > i.date)) errors.push('Kesin hesap tarihinden sonra düzenlenmiş hakediş mevcut');
  if (active.some(h => h.currency !== contract.currency)) errors.push('Aynı anlaşmada farklı para birimli hakediş bulunuyor');

  const approved = active.filter(h => h.approvalStatus === 'onaylandi');
  const alel = approved.filter(h => h.hakedisType === 'alelhesap');
  const ara = approved.filter(h => h.hakedisType === 'ara_hakedis');
  if (alel.length) {
    warnings.push('Alelhesap avans/tahakkuk türü kalıcı olarak saklanmıyor; yalnızca bilgi amaçlı gösterilir');
    errors.push('Alelhesap bulunan dosyada otomatik kesin hesabı kaydetmek için kalıcı sınıflandırma gerekir');
  }
  if (approved.some(h => h.paymentStatus === 'odendi' && !(h.paidAmount > 0))) {
    errors.push('Ödendi işaretli ancak ödeme tutarı boş eski kayıt var; manuel doğrulama gerekli');
  }
  if (related.some(h => h.approvalStatus === 'revize' && (h.paidAmount || 0) > 0)) {
    errors.push('Revize durumundaki kayıtta ödeme var; manuel ödeme kontrolü gerekli');
  }

  const oldItems = ara.flatMap(h => h.hakedisItems || []);
  const oldExtras = ara.flatMap(h => h.extraItems || []);
  const oldMainNet = round(oldItems.reduce((s, r) => s + (Number(r.amount) || 0), 0));
  const previousExtraNet = round(oldExtras.reduce((s, r) => s + (Number(r.amount) || 0), 0));
  const previousAra = round(ara.reduce((s, h) => s + (Number(h.totalAmount) || 0), 0));
  if (!close(previousAra, round(oldMainNet + previousExtraNet))) {
    errors.push('Eski ara hakediş toplamı kalemlerle uyuşmuyor; otomatik mahsup güvenilir değil');
  }
  const allowedIds = new Set((contract.workItemEntries || []).map(r => r.id));
  if (oldItems.some(r => !r.workItemEntryId || !allowedIds.has(r.workItemEntryId))) {
    errors.push('Önceki hakedişte eşleşmeyen birim fiyat kalemi var');
  }
  if (!contract.workItemEntries?.length) errors.push('Anlaşmada birim fiyat kalemi bulunamadı');

  const rowMap = new Map(i.rows.map(r => [r.workItemEntryId, r]));
  const lines: FinalLine[] = [];
  const snapshots: HakedisItem[] = [];
  for (const item of contract.workItemEntries || []) {
    const row = rowMap.get(item.id);
    const history = oldItems.filter(r => r.workItemEntryId === item.id);
    const previousQuantity = history.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    const previousNet = round(history.reduce((s, r) => s + (Number(r.amount) || 0), 0));
    if (row?.finalQuantity == null || !Number.isFinite(row.finalQuantity) || row.finalQuantity < 0) {
      errors.push(item.description + ': nihai metraj gerekli');
      continue;
    }
    if (row.finalQuantity + 0.000001 < previousQuantity) {
      errors.push(item.description + ': nihai metraj önceki onaylı metrajdan küçük');
    }
    if (!Number.isFinite(row.newUnitPrice) || row.newUnitPrice < 0) {
      errors.push(item.description + ': birim fiyat geçersiz');
      continue;
    }
    const newQuantity = Math.max(0, row.finalQuantity - previousQuantity);
    const newNet = round(newQuantity * row.newUnitPrice);
    for (const historic of history) {
      snapshots.push({
        ...historic, id: stableId('settlement-old'),
        settlementSnapshot: 'cumulative_v4b', settlementPeriodAmount: 0,
      });
    }
    if (newQuantity > 0) snapshots.push({
      id: stableId('settlement-new'), workItemEntryId: item.id,
      workCategory: row.workCategory || item.workCategory || contract.workCategory || '',
      description: item.description, unit: item.unit, unitPrice: row.newUnitPrice,
      agreementUnitPrice: item.unitPrice, quantity: newQuantity, amount: newNet,
      settlementSnapshot: 'cumulative_v4b', settlementPeriodAmount: newNet,
    });
    lines.push({
      key: item.id, description: item.description, unit: item.unit,
      workCategory: row.workCategory || item.workCategory || '',
      previousQuantity, finalQuantity: row.finalQuantity, newQuantity,
      previousNet, newNet, totalNet: round(previousNet + newNet),
    });
  }

  // Önceden ara hakedişe alınan ek işler, nihai üretimde yer alır fakat ikinci kez tahakkuk etmez.
  const previousExtras: ExtraWorkItem[] = oldExtras.map(r => ({
    ...r, id: stableId('settlement-old-extra'),
    settlementSnapshot: 'cumulative_v4b', settlementPeriodAmount: 0,
  }));
  const newExtras: ExtraWorkItem[] = buildExtraItems(i.newExtras, i.extraBasis, i.vatRate).map(r => ({
    ...r, settlementSnapshot: 'cumulative_v4b', settlementPeriodAmount: r.amount,
  }));
  for (const row of i.newExtras) {
    if (!(row.description || '').trim()) {
      if (row.quantity != null || row.unitPrice != null || row.lumpAmount != null) errors.push('Ek iş açıklaması gerekli');
    } else if (!((row.lumpAmount || 0) > 0 || ((row.quantity || 0) > 0 && (row.unitPrice || 0) > 0))) {
      errors.push(row.description + ': ek iş miktarı/fiyatı veya toplamı eksik');
    }
  }

  const newExtraNet = round(newExtras.reduce((s, r) => s + r.amount, 0));
  const finalNet = round(lines.reduce((s, r) => s + r.totalNet, 0) + previousExtraNet + newExtraNet);
  const offsetNet = previousAra;
  const periodNet = round(finalNet - offsetNet);
  const paidNet = round(approved.reduce((s, h) => s + (Number(h.paidAmount) || 0), 0));
  const remainingNet = alel.length && !i.alelNature ? null : round(finalNet - paidNet);

  if (periodNet < -0.02) errors.push('Dönem tahakkuku negatif; manuel kesin hesap gerekli');
  if (!Number.isFinite(finalNet) || !Number.isFinite(periodNet)) errors.push('Geçersiz kesin hesap tutarı');
  if (remainingNet !== null && remainingNet < -0.02) warnings.push('Fazla ödeme / devreden avans bulunuyor');
  if (oldExtras.length) warnings.push('Önceden hakedişe alınmış ek işler nihai üretime taşındı; yeni dönem tutarına tekrar eklenmedi');
  if (alel.length && i.alelNature) warnings.push('Alelhesap türü seçimi yalnızca önizlemedir, kalıcı kaydedilmedi');

  const result: FinalResult = {
    errors, warnings, lines, previousExtras, newExtras, previousExtraNet, newExtraNet,
    finalNet, offsetNet, periodNet, paidNet, remainingNet, data: null,
  };
  if (errors.length) return result;
  const director = i.user.role === 'direktor';
  result.data = {
    hakedisNo: nextContractHakedisNo(contract, 'kesin_hesap', i.all),
    hakedisType: 'kesin_hesap', projectId: contract.projectId,
    subcontractor: contract.subcontractor, contractId: contract.id,
    contractNo: contract.contractNo, contractType: contract.contractType,
    currency: contract.currency, vatRate: i.vatRate, date: i.date,
    description: i.description?.trim() || 'Nihai metraj ve ek işler kesin hesabı',
    hakedisItems: snapshots, extraItems: [...previousExtras, ...newExtras],
    totalAmount: finalNet, offsetAmount: offsetNet, paidAmount: 0,
    paymentStatus: 'odenmedi', isUrgent: !!i.urgent,
    createdBy: i.user.id, approvalStatus: director ? 'onaylandi' : 'onay_bekliyor',
    approvedBy: director ? i.user.label : undefined,
    approvalDate: director ? new Date().toISOString() : undefined,
  };
  return result;
}
