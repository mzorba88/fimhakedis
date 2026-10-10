import { describe, it, expect } from 'vitest';
import { buildUnitPriceAgreement, buildLumpSumAgreement, checkPaymentPlan, readPriceBasis, agreementValueStatus, toNet } from './agreements';
import { collectPriceObservations, suggestUnitPrice } from './priceMemory';
import type { WorkEntry, SubcontractorHakedis } from '@/types/hakedis';

const H = { projectId: 'P1', subcontractor: 'Ali Usta', currency: 'GBP' as const, vatRate: 20, priceBasis: 'kdv_haric' as const, date: '2026-10-10', contractNo: 'SZ-T1', createdBy: 'u' };
const asEntry = (p: any, id = 'c1'): WorkEntry => ({ ...p, id, createdAt: '', updatedAt: '' });

const contract = (o: Partial<WorkEntry>): WorkEntry => ({
  id: 'x', contractNo: 'SZ-1', projectId: 'P1', workCategory: 'Seramik', subcontractor: 'Ali Usta', contractType: 'birim_fiyat',
  date: '2025-01-01', currency: 'GBP', createdBy: 'u', approvalStatus: 'onaylandi', totalAmount: 0, paymentStatus: 'odenmedi', createdAt: '', updatedAt: '', ...o,
});
const hak = (o: Partial<SubcontractorHakedis>): SubcontractorHakedis => ({
  id: 'h', hakedisNo: 'SZ-1-H01', hakedisType: 'ara_hakedis', projectId: 'P2', subcontractor: 'Ali Usta', contractId: '', contractNo: '', contractType: 'birim_fiyat',
  currency: 'GBP', date: '2025-05-01', totalAmount: 0, paidAmount: 0, createdBy: 'u', approvalStatus: 'onaylandi', paymentStatus: 'odenmedi', createdAt: '', updatedAt: '', ...o,
});

describe('İş anlaşmaları', () => {
  it('1. birim fiyatlı anlaşma oluşturur', () => {
    const r = buildUnitPriceAgreement(H, [{ description: 'Seramik 60x60', workCategory: 'Seramik', unit: 'm²', unitPrice: 12, estimatedQuantity: 100 }]);
    expect(r.payload.contractType).toBe('birim_fiyat');
    expect(r.payload.totalAmount).toBe(1200);
    expect(r.totalIsComplete).toBe(true);
  });
  it('2. götürü bedelli anlaşma oluşturur (20/60/20)', () => {
    const { payload } = buildLumpSumAgreement(H, { totalAmount: 10000, workCategory: 'Yapı', planComplete: true, plan: [
      { name: 'Başlangıç', mode: 'yuzde', percentage: 20 }, { name: 'İmalat', mode: 'yuzde', percentage: 60 }, { name: 'Kabul', mode: 'tutar', amount: 2000 }] });
    expect(payload.totalAmount).toBe(10000);
    expect(payload.paymentPlan!.map((p) => p.amount)).toEqual([2000, 6000, 2000]);
    expect(payload.paymentPlan!.every((p) => p.isPaid === false)).toBe(true);
  });
  it('3. önceki onaylı birim fiyatı önerir', () => {
    const obs = collectPriceObservations([], [hak({ hakedisItems: [{ id: 'i', workItemEntryId: '', workCategory: 'Seramik', description: 'Seramik 60x60', unit: 'm2', unitPrice: 12, quantity: 10, amount: 120 }] })]);
    const s = suggestUnitPrice({ subcontractor: 'Ali Usta', projectId: 'P1', description: 'seramik 60 x 60', unit: 'm²', currency: 'GBP' }, obs);
    expect(s.tier).toBe('altyuklenici_son');
    expect(s.suggested?.unitPrice).toBe(12);
  });
  it('4. farklı birim / ebat eşleşmez', () => {
    const obs = collectPriceObservations([], [hak({ hakedisItems: [{ id: 'i', workItemEntryId: '', workCategory: '', description: 'Seramik 60x60', unit: 'm2', unitPrice: 12, quantity: 1, amount: 12 }] })]);
    expect(suggestUnitPrice({ subcontractor: 'Ali Usta', description: 'Seramik 60x60', unit: 'adet', currency: 'GBP' }, obs).tier).toBe('manuel');
    expect(suggestUnitPrice({ subcontractor: 'Ali Usta', description: 'Seramik 30x60', unit: 'm2', currency: 'GBP' }, obs).tier).toBe('manuel');
  });
  it('5. projeye özel fiyat diğer projeye geçmez', () => {
    const obs = collectPriceObservations([
      contract({ id: 'a', projectId: 'P1', date: '2025-01-01', workItemEntries: [{ id: '1', workCategory: '', description: 'Seramik', unit: 'm2', quantity: 0, unitPrice: 12, currency: 'GBP' }] }),
      contract({ id: 'b', projectId: 'P9', date: '2025-06-01', contractNo: 'SZ-9', workItemEntries: [{ id: '1', workCategory: '', description: 'Seramik', unit: 'm2', quantity: 0, unitPrice: 15, currency: 'GBP' }] }),
    ], []);
    expect(suggestUnitPrice({ subcontractor: 'Ali Usta', projectId: 'P1', description: 'Seramik', unit: 'm2', currency: 'GBP' }, obs).suggested?.unitPrice).toBe(12);
    expect(suggestUnitPrice({ subcontractor: 'Ali Usta', projectId: 'P9', description: 'Seramik', unit: 'm2', currency: 'GBP' }, obs).suggested?.unitPrice).toBe(15);
  });
  it('6. anlaşma revizyonu geçmiş hakediş fiyatını değiştirmez', () => {
    const h = hak({ hakedisItems: [{ id: 'i', workItemEntryId: '1', workCategory: '', description: 'Seramik', unit: 'm2', unitPrice: 12, quantity: 10, amount: 120 }], totalAmount: 120 });
    const snapshot = JSON.stringify(h);
    const revised = buildUnitPriceAgreement(H, [{ id: '1', description: 'Seramik', workCategory: '', unit: 'm2', unitPrice: 15 }]);
    expect(revised.payload.workItemEntries![0].unitPrice).toBe(15);
    expect(JSON.stringify(h)).toBe(snapshot);
  });
  it('7. miktarı olmayan kalem kesin toplam üretmez', () => {
    const r = buildUnitPriceAgreement(H, [
      { description: 'A', workCategory: '', unit: 'm2', unitPrice: 10, estimatedQuantity: 5 },
      { description: 'B', workCategory: '', unit: 'm2', unitPrice: 99, estimatedQuantity: null }]);
    expect(r.payload.totalAmount).toBe(50);
    expect(r.totalIsComplete).toBe(false);
    expect(agreementValueStatus(asEntry(r.payload))).toBe('tahmini_eksik');
  });
  it('8. ödeme planı toplam kontrolü', () => {
    expect(checkPaymentPlan(100, [{ amount: 50 }], true).ok).toBe(false);
    expect(checkPaymentPlan(100, [{ amount: 50 }], false).ok).toBe(true);
    expect(checkPaymentPlan(100, [{ amount: 120 }], false).ok).toBe(false);
    expect(() => buildLumpSumAgreement(H, { totalAmount: 100, workCategory: '', planComplete: true, plan: [{ name: 'x', mode: 'yuzde', percentage: 50 }] })).toThrow();
  });
  it('9. KDV esası saklanır ve geri okunur; oransız KDV dahil reddedilir', () => {
    const r = buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_dahil' }, [{ description: 'A', workCategory: '', unit: 'm2', unitPrice: 12, estimatedQuantity: 1 }]);
    const e = asEntry(JSON.parse(JSON.stringify(r.payload)));
    expect(readPriceBasis(e)).toBe('kdv_dahil');
    expect(e.workItemEntries![0].unitPrice).toBe(10);
    expect(e.workItemEntries![0].enteredUnitPrice).toBe(12);
    expect(() => toNet(12, 'kdv_dahil', 0)).toThrow();
    expect(readPriceBasis(contract({ workItemEntries: [{ id: '1', workCategory: '', description: 'x', unit: 'm', quantity: 1, unitPrice: 1, currency: 'GBP' }] }))).toBe('bilinmiyor');
  });
  it('10. eski kayıt yapısıyla uyumlu kalır', () => {
    const r = buildUnitPriceAgreement(H, [{ description: 'A', workCategory: 'X', unit: 'm', unitPrice: 3, estimatedQuantity: 2 }]);
    const w = r.payload.workItemEntries![0];
    expect(Object.keys(w)).toEqual(expect.arrayContaining(['id', 'workCategory', 'description', 'unit', 'quantity', 'unitPrice', 'currency']));
    expect(r.payload.approvalStatus).toBe('onay_bekliyor');
    expect(r.payload.paymentStatus).toBe('odenmedi');
    expect(collectPriceObservations([asEntry(r.payload)], []).length).toBe(1);
  });
});
