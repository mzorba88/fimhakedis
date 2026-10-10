import { describe, it, expect } from 'vitest';
import {
  agreementValueStatus, buildLumpSumAgreement, buildUnitPriceAgreement, countsInContractTotal, planItemUsage, readPriceBasis, validatePlanLinks,
} from './agreements';
import { schema3bContractFields, schema3bHakedisFields } from '@/services/supabaseService';
import type { WorkEntry } from '@/types/hakedis';

const H = { projectId: 'P1', subcontractor: 'Ali', currency: 'GBP' as const, vatRate: 20, date: '2026-10-10', contractNo: 'SZ-T', createdBy: 'u' };
const entry = (p: any, id = 'C1'): WorkEntry => ({ ...p, id, createdAt: '', updatedAt: '' });

describe('Aşama 3B — eski kayıtlar (yeni alanlar yok/NULL)', () => {
  const legacy = entry({ contractNo: 'SZ-1', projectId: 'P', workCategory: 'x', subcontractor: 's', contractType: 'goturu_bedel', date: '', currency: 'TRY', createdBy: 'u', approvalStatus: 'onaylandi', totalAmount: 1000, paymentStatus: 'odenmedi', paymentPlan: [{ id: 'old1', description: 'Avans', amount: 500, currency: 'TRY', isPaid: false }] });
  it('fiyat esası bilinmiyor kalır, bedel durumu hesaplanır, aşama kullanımı boş', () => {
    expect(readPriceBasis(legacy)).toBe('bilinmiyor');
    expect(agreementValueStatus(legacy)).toBe('kesin');
    expect(planItemUsage(legacy, [{ id: 'h', contractId: 'C1', approvalStatus: 'onaylandi' }])[0]).toMatchObject({ approved: 0, remaining: 500 });
  });
  it('şema uygulanmadan yeni kolonlara hiçbir şey yazılmaz', () => {
    expect(schema3bContractFields({ priceBasis: 'kdv_dahil', valueStatus: 'kesin' }, false)).toEqual({});
    expect(schema3bHakedisFields({ planLinks: [{ planItemId: 'pi_1', amount: 1 }] }, false)).toEqual({});
    expect(schema3bContractFields({ priceBasis: 'kdv_dahil' }, true)).toEqual({ price_basis: 'kdv_dahil' });
  });
});

describe('Götürü bedel — ödeme planı olmadan KDV esası', () => {
  it('şema yokken reddedilir, şema varken anlaşma düzeyinde saklanır', () => {
    const input = { totalAmount: 1200, workCategory: 'Boya', plan: [], planComplete: false };
    expect(() => buildLumpSumAgreement({ ...H, priceBasis: 'kdv_dahil' }, input, { schemaApplied: false })).toThrow(/ödeme planı olmadan/);
    const { payload } = buildLumpSumAgreement({ ...H, priceBasis: 'kdv_dahil' }, input, { schemaApplied: true });
    expect(payload.totalAmount).toBe(1000);
    expect(payload.priceBasis).toBe('kdv_dahil');
    expect(readPriceBasis(entry(payload))).toBe('kdv_dahil');
  });
});

describe('Birim fiyat — kesin / tahmini / kısmi / belirsiz', () => {
  const rows = (q: (number | null)[]) => q.map((x, i) => ({ description: `K${i}`, workCategory: 'A', unit: 'm²', unitPrice: 10, estimatedQuantity: x }));
  it('dört durum ayrılır; kesin beyan yalnızca tam metrajla ve şema ile', () => {
    const fixed = buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_haric' }, rows([5, 5]), { declaredFixed: true, schemaApplied: true }).payload;
    expect(agreementValueStatus(entry(fixed))).toBe('kesin');
    const est = buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_haric' }, rows([5, 5]), { schemaApplied: true }).payload;
    expect(agreementValueStatus(entry(est))).toBe('tahmini_tam');
    const part = buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_haric' }, rows([5, null]), { schemaApplied: true }).payload;
    expect(agreementValueStatus(entry(part))).toBe('tahmini_kismi');
    expect(countsInContractTotal(entry(part))).toBe(false);
    const none = buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_haric' }, rows([null]), { schemaApplied: true }).payload;
    expect(agreementValueStatus(entry(none))).toBe('yalniz_birim_fiyat');
    expect(() => buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_haric' }, rows([5, null]), { declaredFixed: true, schemaApplied: true })).toThrow(/tüm kalemlerde/);
    expect(() => buildUnitPriceAgreement({ ...H, priceBasis: 'kdv_haric' }, rows([5]), { declaredFixed: true, schemaApplied: false })).toThrow(/value_status/);
  });
  it('kayıtla çelişen "kesin" beyanı yok sayılır', () => {
    const c = entry({ contractType: 'birim_fiyat', totalAmount: 50, valueStatus: 'kesin', workItemEntries: [{ id: 'a', description: 'x', unit: 'm', unitPrice: 10, quantity: 5 }, { id: 'b', description: 'y', unit: 'm', unitPrice: 10, quantity: 0, quantityUnknown: true }] });
    expect(agreementValueStatus(c)).toBe('tahmini_kismi');
  });
});

describe('Ödeme aşaması bağlantıları', () => {
  const c = entry({ contractType: 'goturu_bedel', totalAmount: 1000, paymentPlan: [{ id: 'pi_a', name: 'Kaba', description: 'Kaba', amount: 600, currency: 'TRY', isPaid: false }, { id: 'pi_b', name: 'İnce', description: 'İnce', amount: 400, currency: 'TRY', isPaid: false }] });
  const hs = [
    { id: 'h1', hakedisNo: 'KH-1', contractId: 'C1', approvalStatus: 'onaylandi', planLinks: [{ planItemId: 'pi_a', amount: 300 }] },
    { id: 'h2', hakedisNo: 'KH-2', contractId: 'C1', approvalStatus: 'onay_bekliyor', planLinks: [{ planItemId: 'pi_a', amount: 200 }, { planItemId: 'pi_b', amount: 100 }] },
    { id: 'h3', hakedisNo: 'KH-3', contractId: 'C1', approvalStatus: 'revize', planLinks: [{ planItemId: 'pi_a', amount: 600 }] },
  ];
  it('bir aşamaya çok kısmi hakediş, bir hakedişe çok aşama; revize sayılmaz', () => {
    const [a, b] = planItemUsage(c, hs);
    expect(a).toMatchObject({ approved: 300, pending: 200, remaining: 100, hakedisNos: ['KH-1', 'KH-2'] });
    expect(b).toMatchObject({ pending: 100, remaining: 300 });
  });
  it('mükerrer tahakkuk ve aynı aşamayı iki kez bağlama engellenir; düzenlemede kendi payı serbest', () => {
    expect(validatePlanLinks(c, [{ planItemId: 'pi_a', amount: 150 }], hs)[0]).toMatch(/mükerrer/);
    expect(validatePlanLinks(c, [{ planItemId: 'pi_a', amount: 50 }, { planItemId: 'pi_a', amount: 10 }], hs).some((e) => /iki kez/.test(e))).toBe(true);
    expect(validatePlanLinks(c, [{ planItemId: 'pi_a', amount: 300 }], hs, 'h2')).toEqual([]);
    expect(validatePlanLinks(c, [{ planItemId: 'pi_x', amount: 1 }], hs)[0]).toMatch(/bulunamadı/);
  });
});
