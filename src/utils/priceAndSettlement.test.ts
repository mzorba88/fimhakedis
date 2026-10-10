import { describe, it, expect } from 'vitest';
import type { SubcontractorHakedis, WorkEntry } from '@/types/hakedis';
import { collectPriceObservations, suggestUnitPrice, priceSegments, normalizeUnit } from './priceMemory';
import { computeFinalSettlementSummary, summarizeFiles, analyzeHakedis } from './hakedisCalculations';
import { getSubcontractorLedgers } from './contractAccounting';

let n = 0;
const h = (p: Partial<SubcontractorHakedis>): SubcontractorHakedis => ({
  id: `x${++n}`, hakedisNo: `HK-${n}`, hakedisType: 'ara_hakedis', projectId: 'p1',
  subcontractor: 'SERAMİKÇİ', contractId: 'c1', contractNo: 'SZ-1', contractType: 'birim_fiyat',
  currency: 'TRY', date: '2026-01-01', totalAmount: 0, paidAmount: 0, offsetAmount: 0,
  createdBy: 'x', approvalStatus: 'onaylandi', paymentStatus: 'odenmedi', createdAt: '', updatedAt: '', ...p,
});
const item = (description: string, unit: string, unitPrice: number, quantity = 10) => ({
  id: `i${++n}`, workItemEntryId: 'w', workCategory: 'Seramik ve Mermer İşçilik', description, unit, unitPrice, quantity, amount: unitPrice * quantity,
});
const contract = (p: Partial<WorkEntry>): WorkEntry => ({
  id: 'c1', contractNo: 'SZ-1', projectId: 'p1', workCategory: 'Seramik ve Mermer İşçilik', subcontractor: 'SERAMİKÇİ',
  contractType: 'birim_fiyat', date: '2026-01-01', currency: 'TRY', createdBy: 'x', approvalStatus: 'onaylandi',
  totalAmount: 0, paymentStatus: 'odenmedi', createdAt: '', updatedAt: '', ...p,
});

describe('Birim Fiyat Hafızası', () => {
  const hk = [
    h({ projectId: 'p1', date: '2026-01-10', hakedisItems: [item('Seramik Döşeme 60 x 60', 'm²', 250)] }),
    h({ projectId: 'p1', date: '2026-03-10', hakedisItems: [item('Seramik döşeme 60x60', 'M2', 280)] }),
    h({ projectId: 'p2', date: '2026-02-10', hakedisItems: [item('Seramik Döşeme 60x60', 'm2', 300)] }),
    h({ projectId: 'p1', date: '2026-04-01', hakedisItems: [item('Seramik Döşeme 30x60', 'm2', 220)] }),
    h({ projectId: 'p1', date: '2026-05-01', hakedisItems: [item('Seramik Döşeme 60x60', 'mtul', 90)] }),
    h({ projectId: 'p1', date: '2026-06-01', approvalStatus: 'onay_bekliyor', hakedisItems: [item('Seramik Döşeme 60x60', 'm2', 999)] }),
    h({ subcontractor: 'BAŞKA USTA', projectId: 'p3', date: '2026-02-01', hakedisItems: [item('Süpürgelik', 'mtul', 40)] }),
  ];
  const obs = collectPriceObservations([], hk);

  it('önceki birim fiyat doğru iş kalemiyle eşleşir (60x60, m²)', () => {
    const s = suggestUnitPrice({ subcontractor: 'Seramikçi', projectId: 'p1', description: 'seramik döşeme 60x60', unit: 'm2', currency: 'TRY' }, obs);
    expect(s.tier).toBe('proje_ozel');
    expect(s.suggested?.unitPrice).toBe(280);
    expect(s.suggested?.sourceNo).toBeTruthy();
  });
  it('farklı ölçü (30x60) ve farklı birim (mtul) yanlış eşleşmez', () => {
    const s = suggestUnitPrice({ subcontractor: 'SERAMİKÇİ', projectId: 'p1', description: 'Seramik Döşeme 60x60', unit: 'm2', currency: 'TRY' }, obs);
    [s.suggested, ...s.alternatives].forEach((o) => {
      expect(o?.unitPrice).not.toBe(220);
      expect(o?.unitPrice).not.toBe(90);
    });
    expect(normalizeUnit('m²')).toBe('m2');
    expect(normalizeUnit('mtul')).not.toBe('m2');
  });
  it('projeye özel fiyat diğer projelere aktarılmaz; yeni projede son onaylı fiyat önerilir', () => {
    const s = suggestUnitPrice({ subcontractor: 'SERAMİKÇİ', projectId: 'p9', description: 'Seramik Döşeme 60x60', unit: 'm2', currency: 'TRY' }, obs);
    expect(s.tier).toBe('altyuklenici_son');
    expect(s.suggested?.unitPrice).toBe(280); // en son onaylı (03-10), p2'nin 300'ü değil
    const p2 = suggestUnitPrice({ subcontractor: 'SERAMİKÇİ', projectId: 'p2', description: 'Seramik Döşeme 60x60', unit: 'm2', currency: 'TRY' }, obs);
    expect(p2.suggested?.unitPrice).toBe(300);
  });
  it('onay bekleyen fiyat varsayılan öneriye kaynak olmaz', () => {
    const s = suggestUnitPrice({ subcontractor: 'SERAMİKÇİ', projectId: 'p1', description: 'Seramik Döşeme 60x60', unit: 'm2', currency: 'TRY' }, obs);
    expect(s.suggested?.unitPrice).not.toBe(999);
    expect(s.history.some((o) => o.unitPrice === 999)).toBe(true); // tarihçede görünür
  });
  it('para birimi farklıysa eşleşmez; başka altyüklenici yalnızca seçenek olur; yoksa manuel', () => {
    expect(suggestUnitPrice({ subcontractor: 'SERAMİKÇİ', description: 'Seramik Döşeme 60x60', unit: 'm2', currency: 'GBP' }, obs).tier).toBe('manuel');
    const other = suggestUnitPrice({ subcontractor: 'SERAMİKÇİ', description: 'Süpürgelik', unit: 'mtul', currency: 'TRY' }, obs);
    expect(other.tier).toBe('diger_kaynak');
    expect(other.suggested).toBeNull();
    expect(other.alternatives[0].subcontractor).toBe('BAŞKA USTA');
  });
  it('geçmiş birim fiyatlar değişmez (kaynak veri mutasyona uğramaz)', () => {
    const snap = JSON.stringify(hk);
    collectPriceObservations([], hk);
    suggestUnitPrice({ subcontractor: 'SERAMİKÇİ', projectId: 'p1', description: 'Seramik Döşeme 60x60', unit: 'm2', currency: 'TRY' }, obs);
    expect(JSON.stringify(hk)).toBe(snap);
  });
  it('fiyat değişikliğinde eski metraj eski fiyatla kalır', () => {
    // 100 m² @250 eski dönem + 50 m² @280 yeni dönem
    expect(priceSegments([{ quantity: 100, unitPrice: 250 }, { quantity: 50, unitPrice: 280 }])).toBe(39000);
    expect(priceSegments([{ quantity: 150, unitPrice: 280 }])).not.toBe(39000);
  });
  it('sözleşme kalemleri de kaynak olur (onaylı birim fiyat sözleşmesi)', () => {
    const o = collectPriceObservations([contract({ workItemEntries: [{ id: 'w1', workCategory: '', description: 'Düz Kalıp İşleri', unit: 'M2', quantity: 2000, unitPrice: 15, currency: 'GBP' }] })], []);
    const s = suggestUnitPrice({ subcontractor: 'SERAMİKÇİ', projectId: 'p1', description: 'DUZ KALIP ISLERI', unit: 'm2', currency: 'GBP' }, o);
    expect(s.suggested?.unitPrice).toBe(15);
  });
});

describe('Alelhesap / ara hakediş / kesin hesap mahsuplaşması', () => {
  it('alelhesap (avans) ödenip kesin hesap: 100.000 imalat, 20.000 avans → kalan 80.000', () => {
    const prev = [h({ hakedisType: 'alelhesap', totalAmount: 20000, paidAmount: 20000, paymentStatus: 'odendi' })];
    const r = computeFinalSettlementSummary({ finalProduction: 100000, previous: prev, alelhesapNature: 'avans' });
    expect(r.newPeriodAccrual).toBe(100000);
    expect(r.advancePayments).toBe(20000);
    expect(r.remainingPayment).toBe(80000);
    const t = computeFinalSettlementSummary({ finalProduction: 100000, previous: prev, alelhesapNature: 'tahakkuk' });
    expect(t.newPeriodAccrual).toBe(80000);
    expect(t.remainingPayment).toBe(80000); // her iki nitelikte de aynı borç — mükerrer düşüm yok
  });
  it('alelhesabın niteliği belirsizse otomatik mahsup yapılmaz', () => {
    const prev = [h({ hakedisType: 'alelhesap', totalAmount: 20000, paidAmount: 20000 })];
    const r = computeFinalSettlementSummary({ finalProduction: 100000, previous: prev });
    expect(Number.isNaN(r.remainingPayment)).toBe(true);
    expect(r.warnings.join()).toContain('manuel inceleme');
  });
  it('ara hakediş + kesin hesap, önceki ara kısmen ödenmiş: 50.000 yeni, 10.000 önceki kalan, 60.000 toplam', () => {
    const prev = [h({ totalAmount: 70000, paidAmount: 60000, paymentStatus: 'kismen_odendi' })];
    const r = computeFinalSettlementSummary({ finalProduction: 120000, previous: prev, vatRate: 20 });
    expect(r.newPeriodAccrual).toBe(50000);
    expect(r.previousUnpaid).toBe(10000);
    expect(r.remainingPayment).toBe(60000);
    expect(r.excl).toBe(50000);
    expect(r.vatAmount).toBe(10000);
    expect(r.incl).toBe(60000);
  });
  it('alelhesap + ara + kesin birlikte: yeni 50.000, ödeme 70.000, kalan 50.000', () => {
    const prev = [
      h({ totalAmount: 70000, paidAmount: 50000, paymentStatus: 'kismen_odendi' }),
      h({ hakedisType: 'alelhesap', totalAmount: 20000, paidAmount: 20000, paymentStatus: 'odendi' }),
    ];
    const r = computeFinalSettlementSummary({ finalProduction: 120000, previous: prev, alelhesapNature: 'avans' });
    expect(r.newPeriodAccrual).toBe(50000);
    expect(r.otherPayments + r.advancePayments).toBe(70000);
    expect(r.remainingPayment).toBe(50000);
  });
  it('dosya özetinde aynı ödeme mükerrer düşülmez (mahsup yalnız ara ile eşleşirse alelhesap avans)', () => {
    const list = [
      h({ date: '2026-01-10', totalAmount: 70000, paidAmount: 50000, paymentStatus: 'kismen_odendi' }),
      h({ hakedisType: 'alelhesap', date: '2026-02-01', totalAmount: 20000, paidAmount: 20000, paymentStatus: 'odendi' }),
      h({ hakedisType: 'kesin_hesap', date: '2026-04-01', totalAmount: 120000, offsetAmount: 70000 }),
    ];
    const b = analyzeHakedis(list[2], list);
    expect(b.alelhesapAsAdvance).toBe(true);
    const [f] = summarizeFiles(list, []);
    expect(f.approvedAccrual).toBe(120000);
    expect(f.advancePayments).toBe(20000);
    expect(f.recordedPayment).toBe(70000);
    expect(f.remainingPayment).toBe(50000);
  });
  it('mahsup ara+alelhesap toplamıyla eşleşirse alelhesap tahakkuk sayılır, sonuç aynı', () => {
    const list = [
      h({ date: '2026-01-10', totalAmount: 70000, paidAmount: 50000, paymentStatus: 'kismen_odendi' }),
      h({ hakedisType: 'alelhesap', date: '2026-02-01', totalAmount: 20000, paidAmount: 20000, paymentStatus: 'odendi' }),
      h({ hakedisType: 'kesin_hesap', date: '2026-04-01', totalAmount: 120000, offsetAmount: 90000 }),
    ];
    const [f] = summarizeFiles(list, []);
    expect(f.advancePayments).toBe(0);
    expect(f.approvedAccrual).toBe(120000);
    expect(f.remainingPayment).toBe(50000);
  });
  it('fazla ödeme "Fazla Ödeme / Devreden Avans" olarak ayrılır', () => {
    const list = [h({ totalAmount: 10000, paidAmount: 12000, paymentStatus: 'odendi' })];
    const [f] = summarizeFiles(list, []);
    expect(f.overpayment).toBe(2000);
    const [led] = getSubcontractorLedgers('SERAMİKÇİ', [], list, () => ({ name: 'P' }));
    expect(led.overpayment).toBe(2000);
  });
  it('onay bekleyenler kesinleşmiş tahakkuka dahil edilmez', () => {
    const list = [h({ totalAmount: 5000, approvalStatus: 'onay_bekliyor' })];
    const [led] = getSubcontractorLedgers('SERAMİKÇİ', [], list, () => ({ name: 'P' }));
    expect(led.approvedTotal).toBe(0);
    expect(led.pendingTotal).toBe(5000);
  });
  it('farklı KDV ve para birimleri karışmaz', () => {
    const list = [
      h({ totalAmount: 1000, vatRate: 20 }),
      h({ totalAmount: 1000, vatRate: 10 }),
      h({ totalAmount: 500, currency: 'GBP', contractId: 'c2' }),
    ];
    const files = summarizeFiles(list, []);
    const tr = files.find((f) => f.currency === 'TRY')!;
    expect(tr.approvedAccrual).toBe(2000);
    expect(tr.vat.approvedAccrual).toBeCloseTo(2300);
    expect(files.find((f) => f.currency === 'GBP')!.approvedAccrual).toBe(500);
  });
  it('cari hesap ekranı kesin hesabı brüt değil dönem tahakkuku olarak sayar', () => {
    const list = [
      h({ date: '2026-01-10', totalAmount: 70000, paidAmount: 70000, paymentStatus: 'odendi' }),
      h({ hakedisType: 'kesin_hesap', date: '2026-03-01', totalAmount: 100000, offsetAmount: 70000 }),
    ];
    const [led] = getSubcontractorLedgers('SERAMİKÇİ', [], list, () => ({ name: 'P' }));
    expect(led.hakedisTotal).toBe(100000); // eskiden 170.000
    expect(led.remainingApproved).toBe(30000);
    expect(led.reliable).toBe(true);
  });
  it('belirsiz geçmiş kayıt otomatik düzeltilmez; dosya güvenilmez işaretlenir', () => {
    const list = [
      h({ date: '2026-01-10', totalAmount: 70000 }),
      h({ hakedisType: 'kesin_hesap', date: '2026-03-01', totalAmount: 30000, offsetAmount: 0 }),
    ];
    const snap = JSON.stringify(list);
    const [led] = getSubcontractorLedgers('SERAMİKÇİ', [], list, () => ({ name: 'P' }));
    expect(led.reliable).toBe(false);
    expect(led.unresolvedNos).toContain(list[1].hakedisNo);
    expect(JSON.stringify(list)).toBe(snap);
  });
});
