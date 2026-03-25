import { 
  formatCurrencyWithType, 
  formatDate, 
  contractTypeLabels, 
  approvalStatusLabels, 
  paymentStatusLabels, 
  hakedisTypeLabels,
  WorkEntry, 
  SubcontractorHakedis, 
  Project, 
} from '@/types/hakedis';
import { toast } from 'sonner';

const loadXLSX = () => import('xlsx');

const dateStr = () => new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');

/** Export a single contract to Excel with financial summary */
export async function exportSingleContractToExcel(
  entry: WorkEntry,
  project: Project | undefined,
  hakedisler: SubcontractorHakedis[]
) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  const relatedHakedisler = hakedisler.filter(h => h.contractId === entry.id && h.approvalStatus === 'onaylandi');

  const vatAmount = entry.vatRate ? entry.totalAmount * (entry.vatRate / 100) : 0;
  const contractTotalWithVat = entry.totalAmount + vatAmount;
  const hakedisTotal = relatedHakedisler.reduce((sum, h) => {
    const hVat = h.vatRate ? h.totalAmount * (h.vatRate / 100) : 0;
    return sum + h.totalAmount + hVat;
  }, 0);
  const paidTotal = relatedHakedisler.reduce((sum, h) => sum + (h.paidAmount || 0), 0);
  const remaining = contractTotalWithVat - paidTotal;

  const data = [
    ['SÖZLEŞME DETAY RAPORU'],
    [`Rapor Tarihi: ${formatDate(new Date().toISOString())}`],
    [],
    ['SÖZLEŞME BİLGİLERİ'],
    ['Sözleşme No', entry.contractNo],
    ['Proje', project ? `${project.projectCode} - ${project.projectName}` : '-'],
    ['Lokasyon', project?.location || '-'],
    ['İş Kalemi', entry.workCategory],
    ['Altyüklenici', entry.subcontractor],
    ['Sözleşme Tipi', contractTypeLabels[entry.contractType]],
    ['Para Birimi', entry.currency],
    ['Tarih', formatDate(entry.date)],
    ['Onay Durumu', approvalStatusLabels[entry.approvalStatus]],
    ['Ödeme Durumu', paymentStatusLabels[entry.paymentStatus]],
    entry.description ? ['Açıklama', entry.description] : [],
    [],
    ['FİNANSAL ÖZET'],
    ['Sözleşme Tutarı (KDV Hariç)', entry.totalAmount],
    ...(entry.vatRate ? [
      [`KDV (%${entry.vatRate})`, vatAmount],
      ['Sözleşme Tutarı (KDV Dahil)', contractTotalWithVat],
    ] : [
      ['Sözleşme Tutarı (KDV Dahil)', contractTotalWithVat],
    ]),
    ['Toplam Hakediş Tutarı (KDV Dahil)', hakedisTotal],
    ['Ödenen Tutar (KDV Dahil)', paidTotal],
    ['Kalan Bakiye (KDV Dahil)', remaining],
  ].filter(r => r.length > 0);

  if (relatedHakedisler.length > 0) {
    data.push([], ['HAKEDİŞ DETAYLARI']);
    data.push(['#', 'Hakediş No', 'Tip', 'Tutar (KDV Hariç)', 'KDV', 'Tutar (KDV Dahil)', 'Ödenen', 'Kalan', 'Durum', 'Tarih']);
    relatedHakedisler.forEach((h, idx) => {
      const hVat = h.vatRate ? h.totalAmount * (h.vatRate / 100) : 0;
      const hTotalWithVat = h.totalAmount + hVat;
      data.push([
        idx + 1,
        h.hakedisNo,
        hakedisTypeLabels[h.hakedisType],
        h.totalAmount,
        hVat,
        hTotalWithVat,
        h.paidAmount || 0,
        hTotalWithVat - (h.paidAmount || 0),
        paymentStatusLabels[h.paymentStatus],
        formatDate(h.date),
      ] as any);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 15 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Sözleşme');
  XLSX.writeFile(wb, `sozlesme-${entry.contractNo}-${dateStr()}.xlsx`);
  toast.success('Sözleşme Excel raporu indirildi');
}

/** Export a single hakedis to Excel with financial summary */
export async function exportSingleHakedisToExcel(
  hakedis: SubcontractorHakedis,
  project: Project | undefined,
  contract: WorkEntry | undefined,
  allHakedisler: SubcontractorHakedis[]
) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  const hakedisVat = hakedis.vatRate ? hakedis.totalAmount * (hakedis.vatRate / 100) : 0;
  const hakedisTotalWithVat = hakedis.totalAmount + hakedisVat;
  const remaining = hakedisTotalWithVat - (hakedis.paidAmount || 0);

  const contractSubtotal = contract?.totalAmount || 0;
  const contractVat = contract?.vatRate ? contractSubtotal * (contract.vatRate / 100) : 0;
  const contractTotalWithVat = contractSubtotal + contractVat;

  const sameContractHakedisler = allHakedisler.filter(h => h.contractId === hakedis.contractId && h.approvalStatus === 'onaylandi');
  const totalHakedisOnContract = sameContractHakedisler.reduce((sum, h) => {
    const hVat = h.vatRate ? h.totalAmount * (h.vatRate / 100) : 0;
    return sum + h.totalAmount + hVat;
  }, 0);
  const totalPaidOnContract = sameContractHakedisler.reduce((sum, h) => sum + (h.paidAmount || 0), 0);

  const data: any[][] = [
    ['HAKEDİŞ DETAY RAPORU'],
    [`Rapor Tarihi: ${formatDate(new Date().toISOString())}`],
    [],
    ['HAKEDİŞ BİLGİLERİ'],
    ['Hakediş No', hakedis.hakedisNo],
    ['Hakediş Tipi', hakedisTypeLabels[hakedis.hakedisType]],
    ['Proje', project ? `${project.projectCode} - ${project.projectName}` : '-'],
    ['Sözleşme No', hakedis.contractNo],
    ['Altyüklenici', hakedis.subcontractor],
    ['Sözleşme Tipi', contractTypeLabels[hakedis.contractType]],
    ['Para Birimi', hakedis.currency],
    ['Tarih', formatDate(hakedis.date)],
    ['Onay Durumu', approvalStatusLabels[hakedis.approvalStatus]],
    ['Ödeme Durumu', paymentStatusLabels[hakedis.paymentStatus]],
  ];
  if (hakedis.description) data.push(['Açıklama', hakedis.description]);
  if (hakedis.approvedBy) data.push(['Onaylayan', hakedis.approvedBy]);
  if (hakedis.approvalDate) data.push(['Onay Tarihi', formatDate(hakedis.approvalDate)]);

  data.push(
    [],
    ['FİNANSAL ÖZET - BU HAKEDİŞ'],
    ['Hakediş Tutarı (KDV Hariç)', hakedis.totalAmount],
    ...(hakedis.vatRate ? [
      [`KDV (%${hakedis.vatRate})`, hakedisVat],
    ] : []),
    ['Hakediş Tutarı (KDV Dahil)', hakedisTotalWithVat],
    ['Ödeme Gerçekleşince Kalan Bakiye (KDV Dahil)', remaining],
    [],
    ['FİNANSAL ÖZET - SÖZLEŞME GENELİ'],
    ['Sözleşme Tutarı (KDV Hariç)', contractSubtotal],
    ...(contract?.vatRate ? [
      [`KDV (%${contract.vatRate})`, contractVat],
    ] : []),
    ['Sözleşme Tutarı (KDV Dahil)', contractTotalWithVat],
    ['Toplam Hakediş Tutarı (KDV Dahil)', totalHakedisOnContract],
    ['Ödeme Gerçekleşince Kalan Bakiye (KDV Dahil)', contractTotalWithVat - totalHakedisOnContract],
  );

  if (hakedis.contractExceededNote) {
    data.push([], ['UYARI', hakedis.contractExceededNote]);
  }

  if (hakedis.hakedisItems && hakedis.hakedisItems.length > 0) {
    data.push([], ['İŞ KALEMLERİ']);
    data.push(['#', 'İş Kalemi', 'Birim', 'Miktar', 'Birim Fiyat', 'Tutar (KDV Hariç)']);
    hakedis.hakedisItems.forEach((item, idx) => {
      data.push([idx + 1, item.description, item.unit, item.quantity, item.unitPrice, item.amount]);
    });
  }

  if (hakedis.extraItems && hakedis.extraItems.length > 0) {
    data.push([], ['SÖZLEŞME HARİCİ EK İŞLER']);
    data.push(['#', 'Açıklama', 'Birim', 'Miktar', 'Birim Fiyat', 'Tutar (KDV Hariç)']);
    hakedis.extraItems.forEach((item, idx) => {
      data.push([idx + 1, item.description, item.unit, item.quantity, item.unitPrice, item.amount]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 28 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Hakediş');
  XLSX.writeFile(wb, `hakedis-${hakedis.hakedisNo}-${dateStr()}.xlsx`);
  toast.success('Hakediş Excel raporu indirildi');
}

/** Export a single payment record to Excel */
export async function exportSinglePaymentToExcel(
  hakedis: SubcontractorHakedis,
  project: Project | undefined,
  contract: WorkEntry | undefined
) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  const remaining = hakedis.totalAmount - (hakedis.paidAmount || 0);

  const data: any[][] = [
    ['ÖDEME DETAY RAPORU'],
    [`Rapor Tarihi: ${formatDate(new Date().toISOString())}`],
    [],
    ['ÖDEME BİLGİLERİ'],
    ['Hakediş No', hakedis.hakedisNo],
    ['Proje', project ? `${project.projectCode} - ${project.projectName}` : '-'],
    ['Sözleşme No', hakedis.contractNo],
    ['Altyüklenici', hakedis.subcontractor],
    ['Para Birimi', hakedis.currency],
    ['Onay Tarihi', hakedis.approvalDate ? formatDate(hakedis.approvalDate) : '-'],
    ['Ödeme Tarihi', hakedis.paidDate ? formatDate(hakedis.paidDate) : '-'],
    ['Ödeme Durumu', paymentStatusLabels[hakedis.paymentStatus]],
    [],
    ['FİNANSAL ÖZET'],
    ['Sözleşme Tutarı', contract?.totalAmount || 0],
    ['Hakediş Tutarı', hakedis.totalAmount],
    ['Ödenen Tutar', hakedis.paidAmount || 0],
    ['Kalan Bakiye', remaining],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 25 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Ödeme');
  XLSX.writeFile(wb, `odeme-${hakedis.hakedisNo}-${dateStr()}.xlsx`);
  toast.success('Ödeme Excel raporu indirildi');
}
