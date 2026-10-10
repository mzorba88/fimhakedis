import { describe, it, expect } from 'vitest';
import type { SubcontractorHakedis, WorkEntry } from '@/types/hakedis';
import { buildNewHakedis, buildUnitRows, previousQuantities, type BuildInput } from './newHakedis';
import { summarizeFiles } from './hakedisCalculations';

const unitC: WorkEntry = {
  id: 'c1', contractNo: 'SZ-1', projectId: 'P1', workCategory: 'Seramik', subcontractor: 'Ali', contractType: 'birim_fiyat',
  date: '2026-01-01', currency: 'GBP', vatRate: 20, createdBy: 'u', approvalStatus: 'onaylandi', totalAmount: 0, paymentStatus: 'odenmedi',
  createdAt: '', updatedAt: '',
  workItemEntries: [
    { id: 'wie_a', workCategory: 'Seramik', description: 'Seramik 60x60', unit: 'm2', quantity: 100, unitPrice: 12, currency: 'GBP' },
    { id: 'wie_b', workCategory: 'Süpürgelik', description: 'Süpürgelik', unit: 'm', quantity: 0, unitPrice: 5, currency: 'GBP' },
    { id: 'wie_c', workCategory: '', description: 'Merdiven', unit: 'adet', quantity: 0, unitPrice: 30, currency: 'GBP' },
  ],
};
const lumpC: WorkEntry = {
  ...unitC, id: 'c2', contractNo: 'SZ-2', contractType: 'goturu_bedel', workItemEntries: undefined, totalAmount: 1000,
  paymentPlan: [
    { id: 'pi_1', description: 'Kaba', amount: 400, currency: 'GBP', isPaid: false },
    { id: 'pi_2', description: 'İnce', amount: 600, currency: 'GBP', isPaid: false },
  ],
};
const noPlanC: WorkEntry = { ...lumpC, id: 'c3', contractNo: 'SZ-3', paymentPlan: [] };
const oldH: SubcontractorHakedis = {
  id: 'h0', hakedisNo: 'SZ-1-H01', hakedisType: 'ara_hakedis', projectId: 'P1', subcontractor: 'Ali', contractId: 'c1', contractNo: 'SZ-1',
  contractType: 'birim_fiyat', currency: 'GBP', vatRate: 20, date: '2026-02-01', totalAmount: 100, paidAmount: 0, createdBy: 'u',
  approvalStatus: 'onaylandi', paymentStatus: 'odenmedi', createdAt: '', updatedAt: '',
  hakedisItems: [{ id: 'hi0', workItemEntryId: 'wie_a', workCategory: 'Seramik', description: 'Seramik 60x60', unit: 'm2', unitPrice: 10, quantity: 10, amount: 100 }],
};
const user = { id: 'u', role: 'saha_sorumlusu', label: 'Şantiye Yöneticisi' };
const base = (o: Partial<BuildInput>): BuildInput => ({
  kind: 'ara_hakedis', contract: unitC, projectId: 'P1', subcontractor: 'Ali', currency: 'GBP', vatRate: 20, date: '2026-10-10',
  isUrgent: false, basis: 'kdv_haric', unitRows: [], extraRows: [], freeAmount: null, planSelections: [], user, hakedisler: [oldH], ...o,
});

describe('Aşama 4A — yeni hakediş', () => {
  it('1: birim fiyatlı anlaşmanın tüm kalemleri otomatik gelir, miktarlar boş', () => {
    const rows = buildUnitRows(unitC, [oldH]);
    expect(rows.map((r) => r.workItemEntryId)).toEqual(['wie_a', 'wie_b', 'wie_c']);
    expect(rows.every((r) => r.quantity === null)).toBe(true);
    expect(rows[0]).toMatchObject({ agreementUnitPrice: 12, workCategory: 'Seramik', unit: 'm2' });
    expect(rows[2].workCategory).toBe('Seramik'); // kategori yoksa anlaşma kategorisi
  });

  it('2+14: metraj girilince tutar hesaplanır; boş kalemler ve önceki metraj eklenmez', () => {
    const rows = buildUnitRows(unitC, [oldH]);
    rows[0].quantity = 20;
    const r = buildNewHakedis(base({ unitRows: rows }));
    expect(r.data?.hakedisItems).toHaveLength(1);
    expect(r.data?.hakedisItems?.[0]).toMatchObject({ workItemEntryId: 'wie_a', quantity: 20, unitPrice: 12, amount: 240, agreementUnitPrice: 12 });
    expect(r.data?.totalAmount).toBe(240);
    expect(rows[0].prevApprovedQty).toBe(10);
    expect(r.data?.hakedisNo).toBe('SZ-1-H02');
  });

  it('3+4: fiyat yalnızca bu hakedişte değişir; anlaşma ve eski hakediş fiyatı değişmez', () => {
    const rows = buildUnitRows(unitC, [oldH]);
    rows[0].quantity = 10; rows[0].overrideUnitPrice = 15; rows[0].overrideReason = 'ek detay';
    const r = buildNewHakedis(base({ unitRows: rows }));
    expect(r.data?.hakedisItems?.[0]).toMatchObject({ unitPrice: 15, agreementUnitPrice: 12, amount: 150, priceOverrideReason: 'ek detay' });
    expect(unitC.workItemEntries![0].unitPrice).toBe(12);
    expect(oldH.hakedisItems![0].unitPrice).toBe(10);
    rows[0].overrideReason = '';
    expect(buildNewHakedis(base({ unitRows: rows })).warnings.join()).toMatch(/gerekçe/);
  });

  it('5+6: aynı hakedişte farklı kategoriler ve ek iş kategorisi raporlanır', () => {
    const rows = buildUnitRows(unitC, []);
    rows[0].quantity = 1; rows[1].quantity = 2; rows[1].workCategory = 'Süpürgelik';
    const r = buildNewHakedis(base({ unitRows: rows, extraRows: [{ id: 'ex1', description: 'İlave tamirat', workCategory: 'Tamirat', unit: 'adet', quantity: 1, unitPrice: 50, lumpAmount: null }], hakedisler: [] }));
    expect(r.data?.hakedisItems?.map((i) => i.workCategory)).toEqual(['Seramik', 'Süpürgelik']);
    expect(r.data?.extraItems?.[0]).toMatchObject({ workCategory: 'Tamirat', amount: 50 });
    expect(r.extraNet).toBe(50); expect(r.mainNet).toBe(22); expect(r.data?.totalAmount).toBe(72);
  });

  it('7+8: götürüde aşama seçimi ve kısmi bağlantı plan_links olarak hazırlanır', () => {
    const r = buildNewHakedis(base({ contract: lumpC, planSelections: [{ planItemId: 'pi_1', amount: 150 }, { planItemId: 'pi_2', amount: 600 }], hakedisler: [] }));
    expect(r.errors).toEqual([]);
    expect(r.data?.planLinks).toEqual([{ planItemId: 'pi_1', amount: 150 }, { planItemId: 'pi_2', amount: 600 }]);
    expect(r.data?.paymentAmount).toBe(750);
    expect(r.data?.paidAmount).toBe(0); expect(r.data?.paymentStatus).toBe('odenmedi'); // bağlantı ödeme değildir
  });

  it('9: aşama aşımı (onay bekleyen dahil) engellenir; revize serbest bırakır', () => {
    const prev = { ...oldH, id: 'h9', contractId: 'c2', approvalStatus: 'onay_bekliyor' as const, hakedisItems: undefined, planLinks: [{ planItemId: 'pi_1', amount: 300 }] };
    const r = buildNewHakedis(base({ contract: lumpC, planSelections: [{ planItemId: 'pi_1', amount: 150 }], hakedisler: [prev] }));
    expect(r.data).toBeNull(); expect(r.errors.join()).toMatch(/mükerrer/);
    const r2 = buildNewHakedis(base({ contract: lumpC, planSelections: [{ planItemId: 'pi_1', amount: 150 }], hakedisler: [{ ...prev, approvalStatus: 'revize' }] }));
    expect(r2.errors).toEqual([]);
  });

  it('ek işler aşama kullanımına dahil edilmez', () => {
    const r = buildNewHakedis(base({ contract: lumpC, planSelections: [{ planItemId: 'pi_1', amount: 100 }], extraRows: [{ id: 'e', description: 'x', workCategory: '', unit: 'adet', quantity: 1, unitPrice: null, lumpAmount: 40 }], hakedisler: [] }));
    expect(r.data?.planLinks).toEqual([{ planItemId: 'pi_1', amount: 100 }]); expect(r.data?.totalAmount).toBe(140); expect(r.warnings).toEqual([]);
  });

  it('10: planı olmayan götürüde serbest tutar; plan_links yazılmaz', () => {
    const r = buildNewHakedis(base({ contract: noPlanC, freeAmount: 250, hakedisler: [] }));
    expect(r.data?.totalAmount).toBe(250); expect('planLinks' in (r.data as object)).toBe(false);
  });

  it('11: KDV dahil giriş matraha çevrilir, KDV iki kez eklenmez', () => {
    const r = buildNewHakedis(base({ contract: noPlanC, basis: 'kdv_dahil', freeAmount: 1200, hakedisler: [] }));
    expect(r.data?.totalAmount).toBe(1000);
    const noRate = buildNewHakedis(base({ contract: noPlanC, basis: 'kdv_dahil', vatRate: undefined, freeAmount: 1200 }));
    expect(noRate.data).toBeNull();
  });

  it('12: sözleşmesiz hakediş mevcut yapıyla (KH-S, ek iş kalemleri) oluşur', () => {
    const r = buildNewHakedis(base({ kind: 'sozlesmesiz', contract: undefined, extraRows: [{ id: 'e', description: 'Boya', workCategory: '', unit: 'm2', quantity: 10, unitPrice: 3, lumpAmount: null }], hakedisler: [{ ...oldH, hakedisNo: 'KH-S113' }] }));
    expect(r.data).toMatchObject({ hakedisNo: 'KH-S114', contractId: null, totalAmount: 30, paymentAmount: 30 });
  });

  it('13+16: rol/onay ve ACİL korunur; kesin hesap bu ekranda kaydedilmez', () => {
    const rows = buildUnitRows(unitC, []); rows[0].quantity = 1;
    const d = buildNewHakedis(base({ unitRows: rows, isUrgent: true, user: { id: 'd', role: 'direktor', label: 'Direktör' } }));
    expect(d.data).toMatchObject({ approvalStatus: 'onaylandi', approvedBy: 'Direktör', isUrgent: true });
    expect(buildNewHakedis(base({ unitRows: rows })).data?.approvalStatus).toBe('onay_bekliyor');
    expect(buildNewHakedis(base({ kind: 'kesin_hesap', unitRows: rows })).data).toBeNull();
  });

  it('15: önceki metraj hesabı revize kayıtları saymaz ve kayıtları değiştirmez', () => {
    const snap = JSON.stringify(oldH);
    const p = previousQuantities('c1', [oldH, { ...oldH, id: 'x', approvalStatus: 'revize' }, { ...oldH, id: 'y', approvalStatus: 'onay_bekliyor' }]);
    expect(p.approved.get('wie_a')).toBe(10); expect(p.pending.get('wie_a')).toBe(10);
    expect(JSON.stringify(oldH)).toBe(snap);
    expect(summarizeFiles([oldH]).length).toBeGreaterThan(0);
  });
});
