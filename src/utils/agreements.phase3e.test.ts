import { describe, it, expect, vi, beforeEach } from 'vitest';

// İzole sahte veritabanı (canlıya istek gitmez). Tabloya göre satırlar; update/insert yakalanır.
const tables: Record<string, any[]> = { contracts: [], hakedisler: [] };
const writes: { table: string; op: string; row: any }[] = [];
vi.mock('@/integrations/supabase/client', () => {
  const from = (t: string) => ({
    insert: (row: any) => ({
      select: () => ({
        single: async () => {
          writes.push({ table: t, op: 'insert', row });
          const stored = JSON.parse(JSON.stringify({ id: `${t}${tables[t].length + 1}`, created_at: 'now', updated_at: 'now', ...row }));
          tables[t].push(stored);
          return { data: stored, error: null };
        },
      }),
    }),
    update: (row: any) => ({
      eq: async (_k: string, id: string) => {
        writes.push({ table: t, op: 'update', row });
        const r = tables[t].find((x) => x.id === id);
        Object.assign(r, JSON.parse(JSON.stringify(row)));
        return { error: null };
      },
    }),
    select: () => ({ order: async () => ({ data: JSON.parse(JSON.stringify(tables[t])), error: null }) }),
  });
  return { supabase: { from } };
});

import { createContract, fetchContracts, updateContract, createHakedis, updateHakedis } from '@/services/supabaseService';
import {
  agreementValueStatus, buildLumpSumAgreement, buildUnitPriceAgreement, contractValueBreakdown, countsInContractTotal,
  readPriceBasis, reconcileLegacyEdit, snapshotItemForHakedis,
} from './agreements';
import { summarizeFiles } from './hakedisCalculations';
import { PLAN_LINKS_WRITE_ENABLED, CONTRACT_AGREEMENT_FIELDS_ENABLED } from '@/config/schemaFeatures';
import type { WorkEntry } from '@/types/hakedis';

const H = { projectId: 'P1', subcontractor: 'Ali', currency: 'GBP' as const, vatRate: 20, date: '2026-10-10', contractNo: 'SZ-T', createdBy: 'u' };
const rows = (q: (number | null)[]) => q.map((x, i) => ({ description: `K${i}`, workCategory: 'A', unit: 'm²', unitPrice: 12, estimatedQuantity: x }));
const save = async (payload: any, no: string) => { await createContract({ ...payload, contractNo: no }); return (await fetchContracts()).find((c) => c.contractNo === no)!; };

beforeEach(() => { tables.contracts.length = 0; tables.hakedisler.length = 0; writes.length = 0; });

describe('Aşama 3E', () => {
  it('anahtarlar: sözleşme alanları açık, plan_links yazımı kapalı', () => {
    expect(CONTRACT_AGREEMENT_FIELDS_ENABLED).toBe(true);
    expect(PLAN_LINKS_WRITE_ENABLED).toBe(false);
  });

  it('1+2: ödeme planı olmadan götürü, KDV dahil esas kaydedilir ve geri okunur', async () => {
    const { payload } = buildLumpSumAgreement({ ...H, priceBasis: 'kdv_dahil' }, { totalAmount: 1200, workCategory: 'Boya', plan: [], planComplete: false });
    const c = await save(payload, 'SZ-1');
    expect(writes[0].row.price_basis).toBe('kdv_dahil');
    expect(writes[0].row.value_status).toBe('kesin');
    expect(c.totalAmount).toBe(1000);
    expect(readPriceBasis(c)).toBe('kdv_dahil');
    expect(c.paymentPlan).toEqual([]);
    // yeniden açılan KDV dahil tutar, girilenle tolerans içinde aynı (KDV çift eklenmez)
    expect(Math.abs(c.totalAmount * (1 + c.vatRate! / 100) - 1200)).toBeLessThan(0.01);
  });

  it('3: KDV hariç esas kaydedilir ve geri okunur; birim fiyat değişmeden saklanır', async () => {
    const { payload } = buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_haric' }, rows([10]));
    const c = await save(payload, 'SZ-2');
    expect(c.priceBasis).toBe('kdv_haric');
    expect(c.workItemEntries![0]).toMatchObject({ unitPrice: 12, enteredUnitPrice: 12 });
    expect(c.valueStatus).toBe('tahmini_tam');
  });

  it('KDV dahil birim fiyat: girilen, esas, oran ve matrah tutarlı', async () => {
    const { payload } = buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_dahil' }, [{ description: 'X', workCategory: 'A', unit: 'm²', unitPrice: 14.4, estimatedQuantity: 10 }]);
    const c = await save(payload, 'SZ-2b');
    const w = c.workItemEntries![0];
    expect([c.priceBasis, c.vatRate, w.enteredUnitPrice, w.unitPrice]).toEqual(['kdv_dahil', 20, 14.4, 12]);
    expect(c.totalAmount).toBe(120);
  });

  it('4: tam metrajlı birim fiyatta kesin bedel yalnızca açık beyanla', async () => {
    const fixed = await save(buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_haric' }, rows([5, 5]), { declaredFixed: true }).payload, 'SZ-3');
    expect(fixed.valueStatus).toBe('kesin');
    expect(agreementValueStatus(fixed)).toBe('kesin');
    const est = await save(buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_haric' }, rows([5, 5])).payload, 'SZ-4');
    expect(agreementValueStatus(est)).toBe('tahmini_tam');
  });

  it('5: metrajı eksik anlaşmada kesin bedel reddedilir', () => {
    expect(() => buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_haric' }, rows([5, null]), { declaredFixed: true })).toThrow(/tüm kalemlerde/);
  });

  it('6: tahmini / kısmi / belirsiz bedel kesin toplamdan ayrı; para birimleri ayrı', () => {
    const mk = (no: string, p: any): WorkEntry => ({ ...p, id: no, contractNo: no, createdAt: '', updatedAt: '', approvalStatus: 'onaylandi' });
    const list = [
      mk('A', buildLumpSumAgreement({ ...H, priceBasis: 'kdv_haric' }, { totalAmount: 1000, workCategory: '', plan: [], planComplete: false }).payload),
      mk('B', buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_haric' }, rows([10])).payload),
      mk('C', buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_haric' }, rows([10, null])).payload),
      mk('D', buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_haric' }, rows([null])).payload),
      mk('E', buildLumpSumAgreement({ ...H, currency: 'TRY', priceBasis: 'kdv_haric' }, { totalAmount: 50, workCategory: '', plan: [], planComplete: false }).payload),
    ];
    const gbp = contractValueBreakdown(list).find((b) => b.currency === 'GBP')!;
    expect([gbp.kesin.amount, gbp.tahmini.amount, gbp.kismi.amount, gbp.belirsiz.count]).toEqual([1000, 120, 120, 1]);
    expect(contractValueBreakdown(list).find((b) => b.currency === 'TRY')!.kesin.amount).toBe(50);
    expect(countsInContractTotal(list[2])).toBe(false);
  });

  it('7: eski formda yalnızca açıklama/tarih düzenlemesi yeni alanları korur', async () => {
    const c = await save(buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_dahil' }, rows([5, 5]), { declaredFixed: true }).payload, 'SZ-5');
    const fields = reconcileLegacyEdit(c, { contractType: c.contractType, vatRate: c.vatRate, totalAmount: c.totalAmount, paymentPlan: c.paymentPlan, workItemEntries: c.workItemEntries });
    expect(fields).toEqual({});
    await updateContract(c.id, { description: 'yeni açıklama', date: '2026-11-01', ...fields });
    const again = (await fetchContracts())[0];
    expect([again.priceBasis, again.valueStatus, again.description]).toEqual(['kdv_dahil', 'kesin', 'yeni açıklama']);
  });

  it('8: fiyat düzenlemesinde KDV esası yeniden doğrulanır', async () => {
    const c = await save(buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_dahil' }, rows([5, 5]), { declaredFixed: true }).payload, 'SZ-6');
    const items = c.workItemEntries!.map((w, i) => (i === 0 ? { ...w, unitPrice: 15 } : w));
    const edited = { contractType: c.contractType, vatRate: c.vatRate, totalAmount: 125, workItemEntries: items };
    expect(() => reconcileLegacyEdit(c, edited)).toThrow(/esas/);
    expect(reconcileLegacyEdit(c, edited, 'koru')).toEqual({ priceBasis: 'kdv_dahil', valueStatus: 'kesin' });
    const unknown = reconcileLegacyEdit(c, edited, 'bilinmiyor');
    expect(unknown).toMatchObject({ priceBasis: null, valueStatus: 'tahmini_tam' });
    expect(unknown.workItemEntries!.every((w) => !w.priceBasis)).toBe(true);
    await updateContract(c.id, { workItemEntries: items, totalAmount: 125, ...unknown });
    const again = (await fetchContracts())[0];
    expect(readPriceBasis(again)).toBe('bilinmiyor');
    // miktar silinince kesin beyanı düşer
    const partial = c.workItemEntries!.map((w, i) => (i === 1 ? { ...w, quantity: 0, quantityUnknown: true } : w));
    expect(reconcileLegacyEdit(c, { ...edited, workItemEntries: partial, totalAmount: 60 }, 'koru').valueStatus).toBe('tahmini_kismi');
  });

  it('9: geçmiş hakediş fiyatı anlaşma değişse de değişmez', () => {
    const w = { id: 'wie_1', workCategory: 'A', description: 'x', unit: 'm²', quantity: 5, unitPrice: 12, currency: 'GBP' as const };
    const snap = snapshotItemForHakedis(w, 3);
    w.unitPrice = 20;
    expect(snap).toMatchObject({ unitPrice: 12, amount: 36 });
  });

  it('10: plan_links bu aşamada veritabanına yazılmaz', async () => {
    await createHakedis({ hakedisNo: 'KH-1', hakedisType: 'ara_hakedis', projectId: 'P1', subcontractor: 'Ali', contractId: 'c', contractNo: 'SZ', contractType: 'goturu_bedel', currency: 'GBP', date: '2026-10-10', totalAmount: 10, paidAmount: 0, createdBy: 'u', approvalStatus: 'onay_bekliyor', paymentStatus: 'odenmedi', planLinks: [{ planItemId: 'pi_1', amount: 10 }] } as any);
    await updateHakedis(tables.hakedisler[0].id, { planLinks: [{ planItemId: 'pi_1', amount: 5 }], description: 'x' } as any);
    writes.filter((x) => x.table === 'hakedisler').forEach((x) => expect('plan_links' in x.row).toBe(false));
  });

  it('11+12: eski NULL alanlı sözleşmeler açılır; hakediş/ödeme toplamları değişmez', async () => {
    tables.contracts.push({ id: 'old', contract_no: 'SZ-ESKI', project_id: 'P1', work_category: 'A', subcontractor: 'Ali', contract_type: 'birim_fiyat', date: '2025-01-01', currency: 'GBP', vat_rate: 20, created_by: 'u', approval_status: 'onaylandi', total_amount: 500, payment_status: 'odenmedi', price_basis: null, value_status: null, work_item_entries: [{ id: 'w', description: 'x', unit: 'm', quantity: 50, unitPrice: 10 }] });
    const [old] = await fetchContracts();
    expect(old.priceBasis).toBeUndefined();
    expect(readPriceBasis(old)).toBe('bilinmiyor');
    expect(agreementValueStatus(old)).toBe('tahmini_tam');
    const hk = [{ id: 'h', hakedisNo: 'KH', hakedisType: 'ara_hakedis', projectId: 'P1', subcontractor: 'Ali', contractId: 'old', contractNo: 'SZ-ESKI', contractType: 'birim_fiyat', currency: 'GBP', date: '2025-02-01', totalAmount: 200, paidAmount: 150, createdBy: 'u', approvalStatus: 'onaylandi', paymentStatus: 'kismen_odendi', createdAt: '', updatedAt: '' }] as any;
    const before = summarizeFiles(hk, [old])[0];
    const withNew = summarizeFiles(hk, [{ ...old, priceBasis: 'kdv_haric', valueStatus: 'kesin' }])[0];
    expect([withNew.approvedAccrual, withNew.recordedPayment, withNew.remainingPayment]).toEqual([before.approvedAccrual, before.recordedPayment, before.remainingPayment]);
    expect([before.approvedAccrual, before.recordedPayment, before.remainingPayment]).toEqual([200, 150, 50]);
  });
});
