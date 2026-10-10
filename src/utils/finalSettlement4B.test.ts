import { describe, expect, it } from 'vitest';
import type { SubcontractorHakedis, WorkEntry } from '@/types/hakedis';
import { prepareFinalSettlement, type FinalInput } from './finalSettlement4B';
import { allocateCategories } from './projectCost';

const contract: WorkEntry = {
  id: 'c1', contractNo: 'SZ-1', projectId: 'P', subcontractor: 'USTA',
  contractType: 'birim_fiyat', workCategory: 'Seramik', currency: 'GBP',
  date: '2026-01-01', totalAmount: 0, paymentStatus: 'odenmedi',
  approvalStatus: 'onaylandi', createdBy: 'u', createdAt: '', updatedAt: '',
  vatRate: 20, workItemEntries: [
    { id: 'w1', description: 'Seramik', unit: 'm2', workCategory: 'Seramik',
      unitPrice: 12, quantity: 0, currency: 'GBP' },
  ],
};
const old: SubcontractorHakedis = {
  id: 'h1', hakedisNo: 'SZ-1-H01', hakedisType: 'ara_hakedis', projectId: 'P',
  subcontractor: 'USTA', contractId: 'c1', contractNo: 'SZ-1', contractType: 'birim_fiyat',
  currency: 'GBP', date: '2026-02-01', totalAmount: 750, paidAmount: 500,
  offsetAmount: 0, createdBy: 'u', approvalStatus: 'onaylandi', paymentStatus: 'kismen_odendi',
  createdAt: '', updatedAt: '',
  hakedisItems: [{ id: 'hi1', workItemEntryId: 'w1', description: 'Seramik', unit: 'm2',
    workCategory: 'Seramik', unitPrice: 10, quantity: 70, amount: 700 }],
  extraItems: [{ id: 'exOld', description: 'Eski tamirat', workCategory: 'Tamirat', unit: 'adet',
    unitPrice: 50, quantity: 1, amount: 50 }],
};
const input = (patch: Partial<FinalInput> = {}): FinalInput => ({
  contract, all: [old], date: '2026-10-11',
  rows: [{ workItemEntryId: 'w1', finalQuantity: 100, newUnitPrice: 12, workCategory: 'Seramik' }],
  newExtras: [], extraBasis: 'kdv_haric', vatRate: 20,
  user: { id: 'u', role: 'direktor', label: 'Direktör' }, ...patch,
});
describe('Aşama 4B — kesin hesap ve ek işler', () => {
  it('eski fiyatı korur; önceki ek iş tekrar tahakkuk etmez', () => {
    const x = prepareFinalSettlement(input());
    expect(x.errors).toEqual([]);
    expect(x.finalNet).toBe(1110); // 700 + 30*12 + 50
    expect(x.offsetNet).toBe(750);
    expect(x.periodNet).toBe(360);
    expect(x.remainingNet).toBe(610);
    expect(x.data?.totalAmount).toBe(1110);
    expect(x.data?.offsetAmount).toBe(750);
    expect(x.previousExtras).toHaveLength(1);
    expect(x.previousExtras[0].settlementPeriodAmount).toBe(0);
  });
  it('iş sırasında çıkan iki yeni ek iş ayrı eklenir ve kategoriyle saklanır', () => {
    const x = prepareFinalSettlement(input({ newExtras: [
      { id: 'n1', description: 'Derz tamiri', workCategory: 'Tamirat', unit: 'm2', quantity: 5, unitPrice: 20, lumpAmount: null },
      { id: 'n2', description: 'Özel detay', workCategory: 'İlave İş', unit: 'adet', quantity: null, unitPrice: null, lumpAmount: 80 },
    ] }));
    expect(x.errors).toEqual([]);
    expect(x.newExtraNet).toBe(180);
    expect(x.finalNet).toBe(1290);
    expect(x.periodNet).toBe(540);
    expect(x.remainingNet).toBe(790);
    expect(x.data?.extraItems).toHaveLength(3);
    expect(x.data?.extraItems?.filter(e => (e.settlementPeriodAmount || 0) > 0)).toHaveLength(2);
    const category = allocateCategories({ ...old, ...x.data!, id: 'f1', approvalStatus: 'onaylandi' }, x.periodNet, contract);
    expect(category.find(c => c.category === 'Tamirat')?.amount).toBeCloseTo(100, 2);
    expect(category.find(c => c.category === 'İlave İş')?.amount).toBeCloseTo(80, 2);
    expect(category.find(c => c.category === 'Seramik')?.amount).toBeCloseTo(360, 2);
  });
  it('alelhesap varsa otomatik kayıt bloklanır', () => {
    const advance = { ...old, id: 'a1', hakedisNo: 'SZ-1-AH01', hakedisType: 'alelhesap' as const,
      hakedisItems: undefined, extraItems: undefined, totalAmount: 200, paidAmount: 200 };
    const x = prepareFinalSettlement(input({ all: [old, advance], alelNature: 'avans' }));
    expect(x.data).toBeNull();
    expect(x.errors.join(' ')).toMatch(/Alelhesap/);
  });
  it('eksik nihai metrajla ve onay bekleyen kayıtla kayıt oluşturmaz', () => {
    expect(prepareFinalSettlement(input({ rows: [] })).data).toBeNull();
    expect(prepareFinalSettlement(input({ all: [old, { ...old, id: 'p1', approvalStatus: 'onay_bekliyor' }] })).data).toBeNull();
  });
  it('önceki onaylı metrajdan düşük nihai metrajı reddeder', () => {
    expect(prepareFinalSettlement(input({ rows: [{ workItemEntryId: 'w1', finalQuantity: 60, newUnitPrice: 12, workCategory: 'Seramik' }] })).data).toBeNull();
  });
  it('eski ödendi kaydında ücret yazılmamışsa bakiye güvenilir sayılmaz', () => {
    const dubious = { ...old, paidAmount: 0, paymentStatus: 'odendi' as const };
    expect(prepareFinalSettlement(input({ all: [dubious] })).data).toBeNull();
  });
});
