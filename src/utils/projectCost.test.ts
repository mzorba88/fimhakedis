import { describe, it, expect } from 'vitest';
import type { SubcontractorHakedis, WorkEntry } from '@/types/hakedis';
import { buildProjectCost, allocateCategories, UNCLASSIFIED } from './projectCost';
import { summarizeFiles } from './hakedisCalculations';

let n = 0;
const h = (p: Partial<SubcontractorHakedis>): SubcontractorHakedis => ({
  id: `p${++n}`, hakedisNo: `HK-${n}`, hakedisType: 'ara_hakedis', projectId: 'P', subcontractor: 'A',
  contractId: 'c1', contractNo: 'SZ-1', contractType: 'goturu_bedel', currency: 'TRY', date: '2026-01-01',
  totalAmount: 0, paidAmount: 0, offsetAmount: 0, createdBy: 'x', approvalStatus: 'onaylandi',
  paymentStatus: 'odenmedi', createdAt: '', updatedAt: '', ...p,
});
const c = (p: Partial<WorkEntry>): WorkEntry => ({
  id: 'c1', contractNo: 'SZ-1', projectId: 'P', workCategory: 'Kalıp İşleri', subcontractor: 'A',
  contractType: 'goturu_bedel', date: '2026-01-01', currency: 'TRY', createdBy: 'x', approvalStatus: 'onaylandi',
  totalAmount: 100000, paymentStatus: 'odenmedi', createdAt: '', updatedAt: '', ...p,
});

const contracts = [c({}), c({ id: 'c2', subcontractor: 'B', currency: 'GBP', totalAmount: 5000, workCategory: 'Elektrik İşleri' }), c({ id: 'cX', projectId: 'OTHER', subcontractor: 'Z' })];
const hk = [
  h({ totalAmount: 40000, paidAmount: 30000, paymentStatus: 'kismen_odendi', vatRate: 20 }),
  h({ subcontractor: 'B', contractId: 'c2', currency: 'GBP', totalAmount: 2000 }),
  h({ subcontractor: 'C', contractId: '', contractNo: '', totalAmount: 800, description: '[Boya ve Dekorasyon] ufak iş' }),
  h({ subcontractor: 'D', contractId: '', contractNo: '', totalAmount: 500, approvalStatus: 'onay_bekliyor' }),
  h({ subcontractor: 'Z', projectId: 'OTHER', contractId: 'cX', totalAmount: 99999 }),
];

describe('Maliyet Yönetimi — kabul testleri', () => {
  const pc = buildProjectCost('P', hk, contracts);

  it('1. projedeki bütün altyükleniciler listelenir (başka proje karışmaz)', () => {
    expect(pc.subcontractors.map((s) => s.subcontractor).sort()).toEqual(['A', 'B', 'C', 'D']);
  });
  it('2. sözleşmeli ve sözleşmesiz hakedişler kaybolmaz; sözleşmesiz sahte bedel oluşturmaz', () => {
    expect(pc.hakedisler).toHaveLength(4);
    const cRow = pc.subcontractors.find((s) => s.subcontractor === 'C')!;
    expect(cRow.contract.excl).toBe(0);
    expect(cRow.approved.excl).toBe(800);
  });
  it('3. yüklenici toplamları merkezi hesapla eşleşir', () => {
    const f = summarizeFiles(hk.filter((x) => x.projectId === 'P'), contracts.filter((x) => x.projectId === 'P'));
    pc.subcontractors.forEach((r) => {
      const m = f.find((x) => x.subcontractor === r.subcontractor && x.currency === r.currency)!;
      expect(r.approved.excl).toBe(m.approvedAccrual);
      expect(r.paid.excl).toBe(m.recordedPayment);
      expect(r.remaining.excl).toBe(m.remainingPayment);
    });
  });
  it('4. para birimleri karışmaz', () => {
    const tr = pc.currencies.find((x) => x.currency === 'TRY')!;
    const gb = pc.currencies.find((x) => x.currency === 'GBP')!;
    expect(tr.approved.excl).toBe(40800);
    expect(gb.approved.excl).toBe(2000);
    expect(tr.contract.excl).toBe(100000);
    expect(tr.pending).toBe(500);
  });
  it('5. aynı hakedişteki birden fazla iş kalemi doğru dağıtılır, kategorisiz kısım sınıflandırılmamış olur', () => {
    const multi = h({
      contractId: '', totalAmount: 1000,
      hakedisItems: [
        { id: '1', workItemEntryId: '', workCategory: 'Seramik ve Mermer İşçilik', description: 's', unit: 'm2', unitPrice: 10, quantity: 60, amount: 600 },
        { id: '2', workItemEntryId: '', workCategory: '', description: 'x', unit: 'adet', unitPrice: 10, quantity: 40, amount: 400 },
      ],
    });
    const a = allocateCategories(multi, 1000);
    expect(a.find((x) => x.category === 'Seramik ve Mermer İşçilik')!.amount).toBe(600);
    expect(a.find((x) => x.category === UNCLASSIFIED)!.amount).toBe(400);
    const withContract = allocateCategories({ ...multi, contractId: 'c1' }, 1000, contracts[0]);
    expect(withContract.find((x) => x.category === 'Kalıp İşleri')!.amount).toBe(400);
  });
  it('6. belirsiz kesin hesap yanlış bakiye üretmez; doğrulanmış kısım ayrı', () => {
    const list = [...hk, h({ date: '2026-02-01', totalAmount: 10000 }), h({ hakedisType: 'kesin_hesap', date: '2026-03-01', totalAmount: 30000 })];
    const p = buildProjectCost('P', list, contracts);
    const tr = p.currencies.find((x) => x.currency === 'TRY')!;
    expect(tr.fullyReliable).toBe(false);
    expect(p.unresolved.length).toBe(1);
    expect(p.subcontractors.find((s) => s.subcontractor === 'A')!.reliable).toBe(false);
    expect(tr.verified.approved.excl).toBe(800); // yalnız C güvenilir
  });
  it('7. niteliği doğrulanmamış alelhesap kullanıcıya listelenir', () => {
    const list = [...hk, h({ hakedisType: 'alelhesap', totalAmount: 5000, paidAmount: 5000 })];
    const p = buildProjectCost('P', list, contracts);
    expect(p.unverifiedAlelhesap).toHaveLength(1);
    expect(p.subcontractors.find((s) => s.subcontractor === 'A')!.unresolvedAlelhesap).toHaveLength(1);
  });
  it('8. KDV: her kaydın kendi oranı; oranı olmayana KDV eklenmez; ödeme esası değişmez', () => {
    const a = pc.subcontractors.find((s) => s.subcontractor === 'A')!;
    expect(a.approved.incl).toBeCloseTo(48000);
    expect(a.paid.excl).toBe(30000); // kayıtlı ödeme KDV hariç esasıyla aynen
    const cRow = pc.subcontractors.find((s) => s.subcontractor === 'C')!;
    expect(cRow.approved.incl).toBe(800);
  });
  it('kategori: sözleşmesiz hakediş [Etiket] ile, sözleşmeli sözleşme kategorisiyle sınıflanır; bütçe yok', () => {
    expect(pc.categories.find((x) => x.category === 'Boya ve Dekorasyon')!.approved.excl).toBe(800);
    expect(pc.categories.find((x) => x.category === 'Kalıp İşleri')!.committed.excl).toBe(100000);
    pc.categories.forEach((x) => expect(x.budget).toBeNull());
  });
});
