import { describe, it, expect, vi, beforeEach } from 'vitest';

// İzole sahte veritabanı: canlı veritabanına hiçbir istek gitmez
const db: any[] = [];
vi.mock('@/integrations/supabase/client', () => {
  const from = (_t: string) => ({
    insert: (row: any) => ({
      select: () => ({
        single: async () => {
          const stored = JSON.parse(JSON.stringify({ id: `id${db.length + 1}`, created_at: 'now', updated_at: 'now', ...row }));
          db.push(stored);
          return { data: stored, error: null };
        },
      }),
    }),
    select: () => ({ order: async () => ({ data: JSON.parse(JSON.stringify(db)), error: null }) }),
  });
  return { supabase: { from } };
});

import { createContract, fetchContracts } from '@/services/supabaseService';
import {
  agreementValueStatus, buildLumpSumAgreement, buildUnitPriceAgreement, countsInContractTotal, readPriceBasis, snapshotItemForHakedis,
} from './agreements';
import { summarizeFiles } from './hakedisCalculations';
import { getContractAccount } from './contractAccounting';

const H = { projectId: 'P1', subcontractor: 'Ali Usta', currency: 'GBP' as const, vatRate: 20, date: '2026-10-10', contractNo: 'SZ-T', createdBy: 'u' };

beforeEach(() => { db.length = 0; });

describe('İş anlaşması kaydet → yeniden aç (sahte veritabanı)', () => {
  it('birim fiyatlı: proje, altyüklenici, kategori, birim, fiyat, KDV ve metraj korunur', async () => {
    const { payload } = buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_dahil' }, [
      { description: 'Seramik 60x60', workCategory: 'Seramik ve Mermer İşçilik', unit: 'm²', unitPrice: 14.4, estimatedQuantity: 100 },
      { description: 'Süpürgelik', workCategory: 'Seramik ve Mermer İşçilik', unit: 'mtul', unitPrice: 6, estimatedQuantity: null },
    ]);
    await createContract({ ...payload, contractNo: 'SZ-T1' });
    const [c] = await fetchContracts();
    expect(c.projectId).toBe('P1');
    expect(c.subcontractor).toBe('Ali Usta');
    expect(c.vatRate).toBe(20);
    expect(readPriceBasis(c)).toBe('kdv_dahil');
    const [a, b] = c.workItemEntries!;
    expect(a).toMatchObject({ workCategory: 'Seramik ve Mermer İşçilik', unit: 'm²', unitPrice: 12, enteredUnitPrice: 14.4, quantity: 100 });
    expect(b).toMatchObject({ quantityUnknown: true, quantity: 0 });
    expect(a.id).toMatch(/^wie_/);
    expect(agreementValueStatus(c)).toBe('tahmini_kismi');
    // yeniden açıp kaydetmek kimlikleri değiştirmez
    const again = buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_haric' }, c.workItemEntries!.map((w) => ({
      id: w.id, description: w.description, workCategory: w.workCategory, unit: w.unit, unitPrice: w.unitPrice, estimatedQuantity: w.quantityUnknown ? null : w.quantity,
    })));
    expect(again.payload.workItemEntries!.map((w) => w.id)).toEqual(c.workItemEntries!.map((w) => w.id));
  });

  it('götürü: bedel, KDV esası ve aşamalar korunur; aşama kimlikleri benzersiz', async () => {
    const { payload } = buildLumpSumAgreement({ ...H, priceBasis: 'kdv_haric' }, {
      totalAmount: 10000, workCategory: 'Yapı İşleri', planComplete: true,
      plan: [{ name: 'Başlangıç', mode: 'yuzde', percentage: 20 }, { name: 'İmalat', mode: 'yuzde', percentage: 60, dueDate: '2026-12-01' }, { name: 'Kabul', mode: 'tutar', amount: 2000 }],
    });
    await createContract({ ...payload, contractNo: 'SZ-T2' });
    const [c] = await fetchContracts();
    expect(c.totalAmount).toBe(10000);
    expect(readPriceBasis(c)).toBe('kdv_haric');
    expect(c.paymentPlan!.map((p) => [p.name, p.amount, p.isPaid])).toEqual([['Başlangıç', 2000, false], ['İmalat', 6000, false], ['Kabul', 2000, false]]);
    expect(c.paymentPlan![1].dueDate).toBe('2026-12-01');
    expect(new Set(c.paymentPlan!.map((p) => p.id)).size).toBe(3);
    expect(agreementValueStatus(c)).toBe('kesin');
  });

  it('ödeme planı olmayan götürü: esas saklanamayacağı için kayıt reddedilir (sahte başarı yok)', () => {
    expect(() => buildLumpSumAgreement({ ...H, priceBasis: 'kdv_dahil' }, { totalAmount: 1200, workCategory: '', planComplete: false, plan: [] }))
      .toThrow(/ödeme planı olmadan/);
    expect(db.length).toBe(0);
  });
});

describe('Eksik metraj finansal toplamlara sızmaz', () => {
  const base = { id: 'x', projectId: 'P1', subcontractor: 'Ali Usta', currency: 'GBP' as const, workCategory: 'S', date: '2026-01-01', createdBy: 'u', approvalStatus: 'onaylandi' as const, paymentStatus: 'odenmedi' as const, createdAt: '', updatedAt: '' };
  const item = (q: number, p = 10) => ({ id: `w${q}${p}`, workCategory: '', description: `k${q}${p}`, unit: 'm2', quantity: q, unitPrice: p, currency: 'GBP' as const });

  it('dört durum ayrılır', () => {
    expect(agreementValueStatus({ ...base, contractNo: 'A', contractType: 'goturu_bedel', totalAmount: 500 })).toBe('kesin');
    expect(agreementValueStatus({ ...base, contractNo: 'B', contractType: 'birim_fiyat', totalAmount: 200, workItemEntries: [item(10), item(10, 20)] })).toBe('tahmini_tam');
    expect(agreementValueStatus({ ...base, contractNo: 'C', contractType: 'birim_fiyat', totalAmount: 100, workItemEntries: [item(10), item(0)] })).toBe('tahmini_kismi');
    expect(agreementValueStatus({ ...base, contractNo: 'D', contractType: 'birim_fiyat', totalAmount: 0, workItemEntries: [item(0)] })).toBe('yalniz_birim_fiyat');
  });

  it('kısmi/belirsiz bedel anlaşılan bedele katılmaz, sözleşmeye kalan hesaplanmaz', () => {
    const partial = { ...base, contractNo: 'C', contractType: 'birim_fiyat' as const, totalAmount: 100, workItemEntries: [item(10), item(0)] };
    const lump = { ...base, id: 'y', contractNo: 'A', contractType: 'goturu_bedel' as const, totalAmount: 500 };
    const [f] = summarizeFiles([], [partial, lump]);
    expect(f.contractTotal).toBe(500);
    expect(f.incompleteContracts).toEqual(['C']);
    expect(f.remainingContract).toBe(0);
    expect(countsInContractTotal(partial)).toBe(false);
    const acc = getContractAccount(partial as any, []);
    expect(acc.contractTotal).toBe(0);
    expect(acc.valueStatus).toBe('tahmini_kismi');
  });

  it('hakediş kalemi anlaşma fiyatının değişmez kopyasını alır', () => {
    const w = item(10, 12);
    const snap = snapshotItemForHakedis(w, 5);
    w.unitPrice = 15; // anlaşma sonradan revize edildi
    expect(snap).toMatchObject({ unitPrice: 12, amount: 60, workItemEntryId: w.id });
  });
});
