import * as XLSX from 'xlsx';
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
  Currency 
} from '@/types/hakedis';
import { toast } from 'sonner';

const dateStr = () => new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');

/** Export a single contract to Excel with financial summary */
export function exportSingleContractToExcel(
  entry: WorkEntry,
  project: Project | undefined,
  hakedisler: SubcontractorHakedis[]
) {
  const wb = XLSX.utils.book_new();
  const relatedHakedisler = hakedisler.filter(h => h.contractId === entry.id && h.approvalStatus === 'onaylandi');
  const hakedisTotal = relatedHakedisler.reduce((sum, h) => sum + h.totalAmount, 0);
  const paidTotal = relatedHakedisler.reduce((sum, h) => sum + (h.paidAmount || 0), 0);
  const remaining = hakedisTotal - paidTotal;

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
    ['Sözleşme Tutarı', entry.totalAmount],
    ['Toplam Hakediş Tutarı', hakedisTotal],
    ['Ödenen Tutar', paidTotal],
    ['Kalan Bakiye', remaining],
  ].filter(r => r.length > 0);

  // Add hakedis detail if exists
  if (relatedHakedisler.length > 0) {
    data.push([], ['HAKEDİŞ DETAYLARI']);
    data.push(['#', 'Hakediş No', 'Tip', 'Tutar', 'Ödenen', 'Kalan', 'Durum', 'Tarih']);
    relatedHakedisler.forEach((h, idx) => {
      data.push([
        idx + 1,
        h.hakedisNo,
        hakedisTypeLabels[h.hakedisType],
        h.totalAmount,
        h.paidAmount || 0,
        h.totalAmount - (h.paidAmount || 0),
        paymentStatusLabels[h.paymentStatus],
        formatDate(h.date),
      ] as any);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Sözleşme');
  XLSX.writeFile(wb, `sozlesme-${entry.contractNo}-${dateStr()}.xlsx`);
  toast.success('Sözleşme Excel raporu indirildi');
}

/** Export a single hakedis to Excel with financial summary */
export function exportSingleHakedisToExcel(
  hakedis: SubcontractorHakedis,
  project: Project | undefined,
  contract: WorkEntry | undefined,
  allHakedisler: SubcontractorHakedis[]
) {
  const wb = XLSX.utils.book_new();
  const remaining = hakedis.totalAmount - (hakedis.paidAmount || 0);

  // Previous hakedisler for same contract
  const sameContractHakedisler = allHakedisler.filter(h => h.contractId === hakedis.contractId && h.approvalStatus === 'onaylandi');
  const totalHakedisOnContract = sameContractHakedisler.reduce((sum, h) => sum + h.totalAmount, 0);
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
    ['Hakediş Tutarı', hakedis.totalAmount],
    ['Ödenen Tutar', hakedis.paidAmount || 0],
    ['Kalan Bakiye', remaining],
    [],
    ['FİNANSAL ÖZET - SÖZLEŞME GENELİ'],
    ['Sözleşme Tutarı', contract?.totalAmount || 0],
    ['Toplam Hakediş Tutarı', totalHakedisOnContract],
    ['Toplam Ödenen', totalPaidOnContract],
    ['Sözleşme Kalan Bakiye', totalHakedisOnContract - totalPaidOnContract],
  );

  if (hakedis.contractExceededNote) {
    data.push([], ['UYARI', hakedis.contractExceededNote]);
  }

  // Hakedis items detail
  if (hakedis.hakedisItems && hakedis.hakedisItems.length > 0) {
    data.push([], ['İŞ KALEMLERİ']);
    data.push(['#', 'İş Kalemi', 'Birim', 'Miktar', 'Birim Fiyat', 'Tutar']);
    hakedis.hakedisItems.forEach((item, idx) => {
      data.push([idx + 1, item.description, item.unit, item.quantity, item.unitPrice, item.amount]);
    });
  }

  if (hakedis.extraItems && hakedis.extraItems.length > 0) {
    data.push([], ['SÖZLEŞME HARİCİ EK İŞLER']);
    data.push(['#', 'Açıklama', 'Birim', 'Miktar', 'Birim Fiyat', 'Tutar']);
    hakedis.extraItems.forEach((item, idx) => {
      data.push([idx + 1, item.description, item.unit, item.quantity, item.unitPrice, item.amount]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Hakediş');
  XLSX.writeFile(wb, `hakedis-${hakedis.hakedisNo}-${dateStr()}.xlsx`);
  toast.success('Hakediş Excel raporu indirildi');
}

/** Export a single payment record to Excel */
export function exportSinglePaymentToExcel(
  hakedis: SubcontractorHakedis,
  project: Project | undefined,
  contract: WorkEntry | undefined
) {
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
