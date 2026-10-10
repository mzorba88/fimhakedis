import { describe, it, expect } from 'vitest';
import type { SubcontractorHakedis, WorkEntry } from '@/types/hakedis';
import { analyzeHakedis, summarizeFiles, planPayment, buildFullPaymentUpdate, buildPartialPaymentUpdate, compareOldNew } from './hakedisCalculations';
import { getSubcontractorLedgers, computeFinalSettlement } from './contractAccounting';
import { sumByCurrency, formatCurrencyTotals } from './currencyTotals';

let n = 0;
const h = (p: Partial<SubcontractorHakedis>): SubcontractorHakedis => ({
  id: `h${++n}`, hakedisNo: `HK-${n}`, hakedisType: 'ara_hakedis', projectId: 'p1',
  subcontractor: 'ACME', contractId: 'c1', contractNo: 'SZ-1', contractType: 'goturu_bedel',
  currency: 'TRY', date: '2026-01-01', totalAmount: 0, paidAmount: 0, offsetAmount: 0,
  createdBy: 'x', approvalStatus: 'onaylandi', paymentStatus: 'odenmedi',
  createdAt: '', updatedAt: '', ...p,
});
const contract: WorkEntry = {
  id: 'c1', contractNo: 'SZ-1', projectId: 'p1', workCategory: 'Ahşap', subcontractor: 'ACME',
  contractType: 'goturu_bedel', date: '2026-01-01', currency: 'TRY', createdBy: 'x',
  approvalStatus: 'onaylandi', totalAmount: 150000, paymentStatus: 'odenmedi', createdAt: '', updatedAt: '',
};
const info = () => ({ name: 'P1', code: 'P1' });

// Senaryo A/B ortak veri: 70.000 onaylı ara (50.000 ödenmiş), kesin 100.000 kümülatif, mahsup 70.000
const scenarioAB = (kesinPaid: Partial<SubcontractorHakedis> = {}) => [
  h({ date: '2026-01-10', totalAmount: 70000, paidAmount: 50000, paymentStatus: 'kismen_odendi' }),
  h({ id: 'kh', hakedisType: 'kesin_hesap', date: '2026-03-01', totalAmount: 100000, offsetAmount: 70000, ...kesinPaid }),
];

describe('A. kümülatif kesin hesap', () => {
  it('dönem hakedişi 30.000, toplam kalan 50.000', () => {
    const list = scenarioAB();
    const b = analyzeHakedis(list[1], list);
    expect(b.basis).toBe('kumulatif');
    expect(b.periodAmount).toBe(30000);
    expect(b.cumulativeProduction).toBe(100000);
    const [f] = summarizeFiles(list, [contract]);
    expect(f.approvedAccrual).toBe(100000);
    expect(f.recordedPayment).toBe(50000);
    expect(f.remainingPayment).toBe(50000);
    expect(f.remainingContract).toBe(50000);
  });
  it('ESKİ hesap: brüt + ara düz toplanıyor (170.000) — fark belgelendi', () => {
    const [led] = getSubcontractorLedgers('ACME', [contract], scenarioAB(), info);
    expect(led.hakedisTotal).toBe(170000);
  });
});

describe('B. kesin hesap 30.000 ödendiğinde', () => {
  it('önceki hakedişlerden kalan 20.000 görünür', () => {
    const list = scenarioAB({ paidAmount: 30000, paymentStatus: 'odendi' });
    const [f] = summarizeFiles(list, [contract]);
    expect(f.remainingPayment).toBe(20000);
  });
  it('1B: paidOf artık odendi kesin hesabın brüt tutarını ödeme saymıyor (eskiden 150.000)', () => {
    const list = scenarioAB({ paidAmount: 0, paymentStatus: 'odendi' });
    const [led] = getSubcontractorLedgers('ACME', [contract], list, info);
    expect(led.paidTotal).toBe(80000); // 1C: merkezi motor — net 30.000 (brüt 100.000 değil)
    const legacy = compareOldNew(list, [contract])[0];
    expect(legacy.oldPaid).toBe(150000); // eski mantık karşılaştırma için korunuyor
    const [f] = summarizeFiles(list, [contract]);
    expect(f.recordedPayment).toBe(80000); // 50.000 + 30.000 net
  });
});

describe('C. onay bekleyen önceki hakediş sonradan onaylanınca', () => {
  const build = (status: 'onay_bekliyor' | 'onaylandi') => [
    h({ date: '2026-01-10', totalAmount: 50000 }),
    h({ date: '2026-02-10', totalAmount: 20000, approvalStatus: status }),
    h({ hakedisType: 'kesin_hesap', date: '2026-03-01', totalAmount: 100000, offsetAmount: 70000 }),
  ];
  it('çift tahakkuk oluşmaz; toplam asla 100.000’i geçmez', () => {
    const before = summarizeFiles(build('onay_bekliyor'), [contract])[0];
    expect(before.approvedAccrual).toBe(80000);
    expect(before.pendingAmount).toBe(20000);
    const after = summarizeFiles(build('onaylandi'), [contract])[0];
    expect(after.approvedAccrual).toBe(100000);
    expect(after.pendingAmount).toBe(0);
  });
  it('ESKİ computeFinalSettlement onaysızları da mahsuba katıyor', () => {
    const list = build('onay_bekliyor');
    const s = computeFinalSettlement({ production: 100000, subcontractor: 'ACME', contractId: 'c1', currency: 'TRY', hakedisler: list.slice(0, 2) });
    expect(s.totalPrevious).toBe(70000);
  });
});

describe('D. tek seferlik kesin hesap', () => {
  it('mahsup yoksa tutar doğrudan dönem hakedişidir', () => {
    const list = [h({ hakedisType: 'kesin_hesap', totalAmount: 40000 })];
    const b = analyzeHakedis(list[0], list);
    expect(b.basis).toBe('tek_seferlik');
    expect(b.periodAmount).toBe(40000);
  });
});

describe('E. farklı para birimleri', () => {
  it('asla toplanmaz', () => {
    const list = [h({ totalAmount: 1000, currency: 'TRY' }), h({ totalAmount: 500, currency: 'GBP', contractId: '' })];
    const files = summarizeFiles(list, []);
    expect(files).toHaveLength(2);
    const t = sumByCurrency(list, (x) => x.totalAmount, (x) => x.currency);
    expect(t).toEqual({ TRY: 1000, GBP: 500 });
    expect(formatCurrencyTotals(t)).toContain('£');
  });
});

describe('F. dönem tutarı girilmiş eski kesin hesap', () => {
  it('yeniden mahsup edilmez, belirsiz işaretlenir ve tahakkuk üretilmez', () => {
    const list = [
      h({ date: '2026-01-10', totalAmount: 70000 }),
      h({ hakedisType: 'kesin_hesap', date: '2026-03-01', totalAmount: 30000, offsetAmount: 0 }),
    ];
    const b = analyzeHakedis(list[1], list);
    expect(b.basis).toBe('belirsiz');
    expect(b.periodAmount).toBeNull();
    const [f] = summarizeFiles(list, [contract]);
    expect(f.approvedAccrual).toBe(70000);
    expect(f.unresolved.map((u) => u.id)).toContain(list[1].id);
  });
  it('manuel teyitle dönem esası verilirse olduğu gibi sayılır', () => {
    const list = [
      h({ date: '2026-01-10', totalAmount: 70000 }),
      h({ id: 'khF', hakedisType: 'kesin_hesap', date: '2026-03-01', totalAmount: 30000 }),
    ];
    const [f] = summarizeFiles(list, [contract], { basisOverrides: { khF: 'donem' } });
    expect(f.approvedAccrual).toBe(100000);
  });
});

describe('G. bekleyen / revize hakedişler', () => {
  it('kesinleşmiş borç olarak gösterilmez', () => {
    const list = [
      h({ totalAmount: 10000, approvalStatus: 'onay_bekliyor' }),
      h({ totalAmount: 5000, approvalStatus: 'revize' }),
    ];
    const [f] = summarizeFiles(list, [contract]);
    expect(f.approvedAccrual).toBe(0);
    expect(f.remainingPayment).toBe(0);
    expect(f.pendingAmount).toBe(15000);
  });
});

describe('Şüpheli kayıt kalıpları', () => {
  it('önceki kayıt yokken mahsup → belirsiz (SZ-1101-KH01 tipi)', () => {
    const list = [h({ hakedisType: 'kesin_hesap', totalAmount: 4500, offsetAmount: 4500, currency: 'GBP' })];
    expect(analyzeHakedis(list[0], list).basis).toBe('belirsiz');
  });
  it('kesin hesaptan sonra ara hakediş → belirsiz (SZ-1051-KH01 tipi)', () => {
    const list = [
      h({ hakedisType: 'kesin_hesap', date: '2026-03-01', totalAmount: 10000 }),
      h({ date: '2026-03-15', totalAmount: 2000 }),
    ];
    expect(analyzeHakedis(list[0], list).basis).toBe('belirsiz');
  });
  it('net negatif → belirsiz (SZ-1039-KH01 tipi)', () => {
    const list = [
      h({ date: '2026-01-10', totalAmount: 10000 }),
      h({ hakedisType: 'kesin_hesap', date: '2026-03-01', totalAmount: 4000, offsetAmount: 10000 }),
    ];
    expect(analyzeHakedis(list[1], list).basis).toBe('belirsiz');
  });
  it('ödeme > net → uyarı, paid_amount ham değeri korunur (SZ-1037-KH01 tipi)', () => {
    const list = [
      h({ date: '2026-01-10', totalAmount: 27272.73 }),
      h({ hakedisType: 'kesin_hesap', date: '2026-03-01', totalAmount: 38181.82, offsetAmount: 27272.73, paidAmount: 38181.82, paymentStatus: 'odendi' }),
    ];
    const b = analyzeHakedis(list[1], list);
    expect(b.rawPaidAmount).toBe(38181.82);
    expect(b.reasons.join()).toContain('Kayıtlı ödeme dönem hakedişinden büyük');
  });
});

/* ======================= Aşama 1B: ödeme güvenliği ======================= */
describe('1B. Tam Ödeme güvenliği', () => {
  it('kısmen ödenmiş kesin hesapta yalnızca kalan güvenilir tutar ödenir', () => {
    const list = scenarioAB({ paidAmount: 10000, paymentStatus: 'kismen_odendi' });
    const { update, plan } = buildFullPaymentUpdate(list[1], list);
    expect(plan.remaining).toBe(20000);
    expect(update).toEqual({ paymentStatus: 'odendi', paidAmount: 30000, isUrgent: false });
  });
  it('kümülatif kesin hesabın brüt tutarı ödeme olarak yazılmaz', () => {
    const list = scenarioAB();
    const { update } = buildFullPaymentUpdate(list[1], list);
    expect(update?.paidAmount).toBe(30000);
    expect(update?.paidAmount).not.toBe(100000);
  });
  it('önceki ara hakedişlerden kalan borç silinmez', () => {
    const list = scenarioAB();
    const { update } = buildFullPaymentUpdate(list[1], list);
    const after = list.map((x) => (x.id === list[1].id ? { ...x, ...update! } : x));
    expect(after[0].paidAmount).toBe(50000);
    expect(summarizeFiles(after, [contract])[0].remainingPayment).toBe(20000);
  });
  it('zaten ödenmiş hakedişe tekrar ödeme yazılmaz', () => {
    const list = [h({ totalAmount: 1000, paidAmount: 1000, paymentStatus: 'odendi' })];
    expect(buildFullPaymentUpdate(list[0], list).update).toBeNull();
    expect(buildPartialPaymentUpdate(list[0], list, 10).update).toBeNull();
  });
  it('belirsiz kesin hesap için otomatik ödeme engellenir', () => {
    const list = [h({ hakedisType: 'kesin_hesap', totalAmount: 4500, offsetAmount: 4500, currency: 'GBP' })];
    const r = buildFullPaymentUpdate(list[0], list);
    expect(r.update).toBeNull();
    expect(r.plan.reason).toContain('Manuel inceleme');
    expect(buildPartialPaymentUpdate(list[0], list, 100).update).toBeNull();
  });
  it('KDV: ödeme KDV hariç matrah üzerinden yazılır, KDV dahil tutar karışmaz', () => {
    const list = [h({ totalAmount: 10000, vatRate: 20 })];
    const { update } = buildFullPaymentUpdate(list[0], list);
    expect(update?.paidAmount).toBe(10000); // 12.000 değil
    expect(buildPartialPaymentUpdate(list[0], list, 12000).update).toBeNull();
  });
  it('eski ödeme kayıtları değiştirilmez (girdi nesneleri mutasyona uğramaz)', () => {
    const list = scenarioAB({ paidAmount: 38000, paymentStatus: 'odendi' });
    const snap = JSON.stringify(list);
    summarizeFiles(list, [contract]); compareOldNew(list, [contract]);
    list.forEach((x) => planPayment(x, list));
    expect(JSON.stringify(list)).toBe(snap);
  });
  it('normal ara hakediş, alelhesap ve sözleşmesiz hakediş eskisi gibi tam tutarı öder', () => {
    const ara = h({ totalAmount: 5000 });
    const alel = h({ hakedisType: 'alelhesap', totalAmount: 3000 });
    const small = h({ contractId: '', contractNo: '', totalAmount: 800 });
    const list = [ara, alel, small];
    list.forEach((x) => expect(buildFullPaymentUpdate(x, list).update?.paidAmount).toBe(x.totalAmount));
    expect(buildPartialPaymentUpdate(ara, list, 2000).update).toEqual({ paymentStatus: 'kismen_odendi', paidAmount: 2000 });
    expect(buildPartialPaymentUpdate(ara, list, 5000).update?.paymentStatus).toBe('odendi');
  });
  it('onay bekleyen / revize hakedişe ödeme yapılamaz', () => {
    const list = [h({ totalAmount: 1000, approvalStatus: 'onay_bekliyor' }), h({ totalAmount: 1000, approvalStatus: 'revize' })];
    list.forEach((x) => expect(buildFullPaymentUpdate(x, list).update).toBeNull());
  });
  it('kayıtlı ödeme net tutardan büyükse (SZ-1037 tipi) kısmi ödeme de engellenir', () => {
    const list = scenarioAB({ paidAmount: 90000, paymentStatus: 'kismen_odendi' });
    const p = planPayment(list[1], list);
    expect(p.allowed).toBe(false);
    expect(p.reason).toContain('manuel inceleme');
  });
});

describe('1B. Eski/yeni karşılaştırma', () => {
  it('belirsiz kayıt varsa satır güvenilir değil olarak işaretlenir', () => {
    const list = [
      h({ date: '2026-01-10', totalAmount: 70000 }),
      h({ hakedisType: 'kesin_hesap', date: '2026-03-01', totalAmount: 30000 }),
    ];
    const [r] = compareOldNew(list, [contract]);
    expect(r.reliable).toBe(false);
    expect(r.oldApproved).toBe(100000);
    expect(r.newApprovedAccrual).toBe(70000);
  });
});
